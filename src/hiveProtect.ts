import {TriggerContext, Post, Comment, GetUserOverviewOptions} from "@devvit/public-api";
import {CommentSubmit, PostSubmit, ModAction} from "@devvit/protos";
import {addDays, addHours, subDays} from "date-fns";
import {isModerator, isContributor, getAppName, replaceAll, ThingPrefix, domainFromUrlString, trimLeadingWWW} from "./utility.js";
import {AppSetting, ContentTypeToActOn, PrevBanBehaviour} from "./settings.js";
import {setCleanupForUser} from "./cleanupTasks.js";
import _ from "lodash";

export const APPROVALS_KEY = "ItemApprovalCount";

export async function handlePostSubmitEvent (event: PostSubmit, context: TriggerContext) {
    if (!event.author || !event.author.name || !event.post || !event.subreddit || event.author.id === context.appAccountId) {
        console.log("Event is not in the right state.");
        return;
    }

    await handlePostOrCommentSubmitEvent(event.post.id, event.subreddit.name, event.author.name, context);
}

export async function handleCommentSubmitEvent (event: CommentSubmit, context: TriggerContext) {
    if (!event.author || !event.author.name || !event.comment || !event.subreddit || event.author.id === context.appAccountId) {
        console.log("Event is not in the right state.");
        return;
    }

    await handlePostOrCommentSubmitEvent(event.comment.id, event.subreddit.name, event.author.name, context);
}

export async function handlePostOrCommentSubmitEvent (targetId: string, subredditName: string, userName: string, context: TriggerContext) {
    if (userName === "AutoModerator" || userName === `${subredditName}-ModTeam`) {
        // Automod could legitimately have activity in "bad" subreddits, but we never want to act on it.
        console.log(`${userName} is exempt from all checks.`);
        return false;
    }

    const problematicItemsResult = await problematicItemsFound(context, subredditName, userName);

    if (problematicItemsResult.badSubs.length === 0 && problematicItemsResult.badDomains.length === 0) {
        return;
    }

    const settings = await context.settings.getAll();

    // Now check if the submission is of a type configured to be checked.
    // I'm doing this second because it's likely that most subreddits will be configured as "Posts And Comments",
    // So for most cases, we might be able to reduce load by ruling out based on recently cached negative checks first.
    const typesToActOn = (settings[AppSetting.ContentTypeToActOn] as string[] ?? [ContentTypeToActOn.PostsAndComments])[0];
    if (typesToActOn === ContentTypeToActOn.PostsOnly && targetId.startsWith(ThingPrefix.Comment) || typesToActOn === ContentTypeToActOn.CommentsOnly && targetId.startsWith(ThingPrefix.Post)) {
        // Invalid type of item to check.
        return;
    }

    const banEnabled = settings[AppSetting.BanEnabled] as boolean ?? true;
    const removeEnabled = settings[AppSetting.RemoveEnabled] as boolean ?? true;
    const reportEnabled = settings[AppSetting.ReportEnabled] as boolean ?? false;

    if (banEnabled && problematicItemsResult.userBannable) {
        await banUser(context, subredditName, userName, problematicItemsResult);
    }

    if (removeEnabled) {
        await context.reddit.remove(targetId, true);
        console.log(`Removed item ${targetId}`);
    }

    let replyMessage = settings[AppSetting.ReplyTemplate] as string | undefined;
    if (replyMessage) {
        replyMessage = replaceAll(replyMessage, "{{sublist}}", problematicItemsResult.badSubs.join(", "));
        replyMessage = replaceAll(replyMessage, "{{domainlist}}", problematicItemsResult.badDomains.join(", "));
        replyMessage = replaceAll(replyMessage, "{{permalink}}", problematicItemsResult.itemPermalink ?? "");
        replyMessage = replaceAll(replyMessage, "{{username}}", userName);

        replyMessage = `${replyMessage.trim()}\n\n*I am a bot, and this action was performed automatically. Please [contact the moderators of this subreddit](/message/compose/?to=/r/${subredditName}) if you have any questions or concerns.*`;

        const newComment = await context.reddit.submitComment({id: targetId, text: replyMessage});
        const shouldSticky = targetId.startsWith(ThingPrefix.Post) && (settings[AppSetting.StickyReply] as boolean ?? false);
        await newComment.distinguish(shouldSticky);
        if (settings[AppSetting.LockReply] as boolean ?? true) {
            await newComment.lock();
        }
        console.log(`Reply left on ${targetId}`);
    }

    if (reportEnabled) {
        let reportReason = settings[AppSetting.ReportTemplate] as string | undefined;
        if (reportReason && !removeEnabled) {
            const whitelistThreshold = settings[AppSetting.ReportNumber] as number ?? 3;
            let shouldReport = true;
            if (whitelistThreshold) {
                try {
                    const currentApprovalCount = await context.redis.zScore(APPROVALS_KEY, userName);
                    if (currentApprovalCount >= whitelistThreshold) {
                        console.log(`User ${userName} has too many approvals to report.`);
                        shouldReport = false;
                    }
                } catch {
                    // User has no approvals, so always report.
                }
            }

            if (shouldReport) {
                reportReason = replaceAll(reportReason, "{{sublist}}", problematicItemsResult.badSubs.join(", "));
                reportReason = replaceAll(reportReason, "{{domainlist}}", problematicItemsResult.badDomains.join(", "));
                let target: Post | Comment;
                if (targetId.startsWith(ThingPrefix.Post)) {
                    target = await context.reddit.getPostById(targetId);
                } else {
                    target = await context.reddit.getCommentById(targetId);
                }
                await context.reddit.report(target, {reason: reportReason});
                await context.redis.set(`itemreported~${targetId}`, new Date().getTime.toString(), {expiration: addDays(new Date(), 7)});
                console.log(`Reported comment ${targetId}`);
            }
        }
    }
}

function getLatestResultKey (username: string) {
    return `participation-lastcheckresult-${username}`;
}

interface ProblematicSubsResult {
    badSubs: string[],
    badDomains: string[],
    itemPermalink?: string,
    userBannable: boolean,
}

export async function lastCheckResult (context: TriggerContext, userName: string): Promise<ProblematicSubsResult | undefined> {
    const recentCheckValue = await context.redis.get(getLatestResultKey(userName));

    if (!recentCheckValue) {
        return;
    }

    return JSON.parse(recentCheckValue) as ProblematicSubsResult;
}

async function previousBanDate (context: TriggerContext, subredditName: string, userName: string): Promise<Date | undefined> {
    const redisKey = `participation-prevbanned-${userName}`;
    const previousBanDateAsString = await context.redis.get(redisKey);
    if (!previousBanDateAsString) {
        return;
    }

    const banDate = new Date(parseInt(previousBanDateAsString));
    if (banDate) {
        return banDate;
    }

    // Very early versions of this app stored a simple boolean in the KV Store. Attempt to determine via mod log.
    const appName = await getAppName(context);

    let modLog = await context.reddit.getModerationLog({
        subredditName,
        moderatorUsernames: [appName],
        type: "banuser",
        limit: 1000,
    }).all();

    modLog = modLog.filter(logEntry => logEntry.target && logEntry.target.author && logEntry.target.author === userName);

    if (modLog.length > 0) {
        const banDate = modLog[0].createdAt;
        // Set the value in Redis so we don't have to do this again.
        await context.redis.set(redisKey, banDate.getTime().toString());
        return banDate;
    }

    // Ban date is unknown. Falling back to 1st January 2024 as per documentation.
    return new Date(2024, 1, 1);
}

function isOverThreshold (items: (Post | Comment)[], combinedThreshold?: number, postThreshold?: number, commentThreshold?: number): boolean {
    if (combinedThreshold) {
        if (items.length >= combinedThreshold) {
            return true;
        }
    }

    if (postThreshold) {
        if (items.filter(item => item instanceof Post).length >= postThreshold) {
            return true;
        }
    }

    if (commentThreshold) {
        if (items.filter(item => item instanceof Comment).length >= commentThreshold) {
            return true;
        }
    }

    return false;
}

interface Domain {
    domain: string,
    wildcard: boolean,
}

function isDomainInList (domain: string, domainList: Domain[]): boolean {
    return domainList.some(item => !item.wildcard && domain === item.domain || item.wildcard && domain.endsWith(item.domain));
}

async function problematicItemsFound (context: TriggerContext, subredditName: string, userName: string): Promise<ProblematicSubsResult> {
    const emptyResult = <ProblematicSubsResult>{
        badSubs: [],
        badDomains: [],
        userBannable: false,
    };

    // Shortcut most likely reason for skipping before even retrieving comment or config.
    const lastResult = await lastCheckResult(context, userName);

    if (lastResult) {
        console.log(`Most recent check on ${userName} was too recent. Quitting using previous result value.`);
        return lastResult;
    }

    const settings = await context.settings.getAll();
    const combinedThreshold = settings[AppSetting.CombinedItemCount] as number | undefined;
    const postThreshold = settings[AppSetting.PostCount] as number | undefined;
    const commentThreshold = settings[AppSetting.CommentCount] as number | undefined;

    if (!combinedThreshold && !postThreshold && !commentThreshold) {
        console.log("No thresholds are defined. Quitting.");
        return emptyResult;
    }

    // Get main config and quit if not defined properly.
    const subReddits = settings[AppSetting.Subreddits] as string ?? "";
    const domains = settings[AppSetting.Domains] as string ?? "";

    // Convert into an array of lower-case individual sub names
    const subredditList = subReddits.toLowerCase().split(",").map(subName => subName.trim()).filter(subName => subName !== "");

    const domainList = domains.toLowerCase().split(",")
        .map(domain => trimLeadingWWW(domain.trim()))
        .filter(domain => !domain.endsWith("reddit.com") && !domain.endsWith("redd.it") && domain !== "")
        .map(domain => <Domain>{domain: domain.startsWith("*.") ? domain.replace("*.", "") : domain, wildcard: domain.startsWith("*.")});

    if (subredditList.length === 0 && domainList.length === 0) {
        console.log("No subreddits or domains defined.");
        return emptyResult;
    }

    let userContent: (Post | Comment)[] = [];

    const userOverviewOptions = <GetUserOverviewOptions>{
        username: userName,
        limit: 100,
        pageSize: 100,
        sort: "new",
    };

    try {
        if (combinedThreshold || postThreshold && commentThreshold) {
            userContent = await context.reddit.getCommentsAndPostsByUser(userOverviewOptions).all();
        } else if (postThreshold) {
            userContent = await context.reddit.getPostsByUser(userOverviewOptions).all();
        } else if (commentThreshold) {
            userContent = await context.reddit.getCommentsByUser(userOverviewOptions).all();
        }
    } catch (error) {
        console.log(`Error retrieving posts or comments for ${userName}. Likely shadowbanned`);
    }

    let badSubItems = userContent.filter(item => item.subredditId !== context.subredditId &&
        (subredditList.includes(item.subredditName.toLowerCase()) || item instanceof Post && isDomainInList(domainFromUrlString(item.url), domainList)));

    let failsChecks: boolean | undefined;
    let userBannable = false;

    if (badSubItems.length > 0) {
        // Filter down further to check the configured thresholds. If there was nothing for the user,
        // there is no point even getting these config values.
        const daysToMonitor = settings[AppSetting.DaysToMonitor] as number ?? 28;
        badSubItems = badSubItems.filter(item => item.createdAt > subDays(new Date(), daysToMonitor));
        failsChecks = isOverThreshold(badSubItems, combinedThreshold, postThreshold, commentThreshold);

        if (failsChecks) {
            // Over threshold, but user may have been previously banned.
            console.log("User is over the ban threshold. Checking for previous bans.");
            const previousBan = await previousBanDate(context, subredditName, userName);
            if (previousBan) {
                console.log(`User was previously banned at ${previousBan.toISOString()}`);
                const postBanBehaviour = settings[AppSetting.BehaviourIfPrevBan] as string[] ?? [PrevBanBehaviour.NeverReBan];

                switch (postBanBehaviour[0]) {
                    case PrevBanBehaviour.NeverReBan:
                        console.log("App is configured to never re-ban.");
                        userBannable = false;
                        break;
                    case PrevBanBehaviour.OnlyRebanIfNewContent:
                        console.log("App is configured to only ban based on content since last ban. Disregarding previous content.");
                        badSubItems = badSubItems.filter(item => item.createdAt > previousBan);
                        failsChecks = failsChecks = isOverThreshold(badSubItems, combinedThreshold, postThreshold, commentThreshold);
                        userBannable = failsChecks;
                        break;
                    case PrevBanBehaviour.AlwaysReBan:
                        console.log("App is configured to always re-ban.");
                        userBannable = true;
                        break;
                }
            } else {
                userBannable = true;
            }
        }
    } else {
        failsChecks = false;
    }

    const badPostCount = badSubItems.filter(item => item instanceof Post).length;
    const badCommentCount = badSubItems.filter(item => item instanceof Comment).length;
    console.log(`Found ${badPostCount} post(s) and ${badCommentCount} comment(s) of concern for ${userName}. Over threshold: ${JSON.stringify(failsChecks)}`);

    if (failsChecks) {
        // Now check if user is a mod, approved or previously banned. These are generally unlikely to be
        // true for most subs, so we only do these checks if the user was going to be banned otherwise.
        const skipChecksPromises: Promise<boolean>[] = [isModerator(context, subredditName, userName)];
        if (settings[AppSetting.ExemptApprovedUser] as boolean ?? false) {
            skipChecksPromises.push(isContributor(context, subredditName, userName));
        }

        const reasonsToSkipChecks = await Promise.all(skipChecksPromises);

        // If any check returns "True", user isn't eligible to be checked.
        if (reasonsToSkipChecks.includes(true)) {
            console.log(`User ${userName} is not due a ban (mod or approved)`);
            failsChecks = false;
        }
    }

    let result: ProblematicSubsResult;
    if (failsChecks) {
        result = <ProblematicSubsResult>{
            badSubs: _.uniq(badSubItems.filter(item => subredditList.includes(item.subredditName.toLowerCase())).map(item => item.subredditName)),
            badDomains: _.uniq(badSubItems.filter(item => item instanceof Post && isDomainInList(domainFromUrlString(item.url), domainList)).map(item => domainFromUrlString(item.url))),
            itemPermalink: badSubItems[0].permalink,
            userBannable,
        };
        console.log(result);
    } else {
        result = emptyResult;
    }

    // Store record of this result. Cache for 1 hour if a positive result, or 6 hours if negative.
    let cacheExpiryTime: Date;
    if (result.badSubs.length > 0 || result.badDomains.length > 0) {
        cacheExpiryTime = addHours(new Date(), 1);
    } else {
        cacheExpiryTime = addHours(new Date(), 6);
    }
    await context.redis.set(getLatestResultKey(userName), JSON.stringify(result), {expiration: cacheExpiryTime});

    return result;
}

async function banUser (context: TriggerContext, subredditName: string, userName: string, problematicItemsResult: ProblematicSubsResult): Promise<void> {
    const settings = await context.settings.getAll();

    let banMessage = settings[AppSetting.BanMessage] as string | undefined;
    if (banMessage) {
        banMessage = banMessage.replace("{{sublist}}", problematicItemsResult.badSubs.join(", "));
        banMessage = banMessage.replace("{{domainlist}}", problematicItemsResult.badDomains.join(", "));
        banMessage = banMessage.replace("{{permalink}}", problematicItemsResult.itemPermalink ?? "");
        banMessage = banMessage.replace("{{username}}", userName);
    }
    const banNote = settings[AppSetting.BanNote] as string | undefined;

    let banDuration = settings[AppSetting.BanDuration] as number | undefined;
    if (banDuration === 0) {
        banDuration = undefined;
    }

    let banReason: string;
    if (banNote) {
        banReason = `Hive Protector: ${banNote}`;
    } else {
        banReason = "Banned by Hive Protector. Matches in {{sublist}}";
    }

    banReason = banReason.replace("{{sublist}}", problematicItemsResult.badSubs.join(", "));
    banReason = banReason.replace("{{domainlist}}", problematicItemsResult.badDomains.join(", "));

    await context.reddit.banUser({
        username: userName,
        reason: banReason,
        message: banMessage,
        subredditName,
        duration: banDuration,
    });

    await context.redis.set(`participation-prevbanned-${userName}`, new Date().getTime().toString());
    await setCleanupForUser(userName, context);

    console.log(`Banned ${userName} from ${subredditName}`);
}

export async function handleModActionEvent (event: ModAction, context: TriggerContext) {
    if (event.targetUser && (event.action === "unbanuser" || event.action === "banuser")) {
        console.log(`Detected a ${event.action} event for ${event.targetUser.name}. Removing cached check results that may exist.`);
        // Clear down previous check after unban
        await context.redis.del(getLatestResultKey(event.targetUser.name));
    }

    if (event.targetUser && (event.action === "approvecomment" || event.action === "approvelink")) {
        let targetId: string | undefined;
        if (event.action === "approvecomment" && event.targetComment) {
            targetId = event.targetComment.id;
        } else if (event.action === "approvelink" && event.targetPost) {
            targetId = event.targetPost.id;
        }

        if (!targetId) {
            // This should be impossible, but handle anyway.
            return;
        }

        // Check to see if post/comment was previously flagged by this app.
        const itemReported = await context.redis.get(`itemreported~${targetId}`);
        if (!itemReported) {
            return;
        }

        // Increment approvals counter.
        const newApprovalCount = await context.redis.zIncrBy(APPROVALS_KEY, event.targetUser.name, 1);
        await setCleanupForUser(event.targetUser.name, context);
        console.log(`Approved a reported comment by ${event.targetUser.name}. Approval counter is now ${newApprovalCount}.`);
    }
}
