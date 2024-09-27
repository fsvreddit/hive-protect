import {TriggerContext, Post, Comment, GetUserOverviewOptions, User} from "@devvit/public-api";
import {CommentSubmit, PostSubmit, ModAction} from "@devvit/protos";
import {addDays, addHours, subDays, subMonths} from "date-fns";
import {isModerator, isContributor, getAppName, replaceAll, ThingPrefix, domainFromUrlString, trimLeadingWWW, getPostOrCommentById} from "./utility.js";
import {AppSetting, ContentTypeToActOn, PrevBanBehaviour} from "./settings.js";
import {setCleanupForUser} from "./cleanupTasks.js";
import _ from "lodash";
import pluralize from "pluralize";

export const APPROVALS_KEY = "ItemApprovalCount";

export async function handlePostSubmitEvent (event: PostSubmit, context: TriggerContext) {
    if (!event.author?.name || !event.post || !event.subreddit || event.author.id === context.appAccountId) {
        console.log("Event is not in the right state.");
        return;
    }

    await handlePostOrCommentSubmitEvent(event.post.id, event.subreddit.name, event.author.name, context);
}

export async function handleCommentSubmitEvent (event: CommentSubmit, context: TriggerContext) {
    if (!event.author?.name || !event.comment || !event.subreddit || event.author.id === context.appAccountId) {
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
        if (problematicItemsResult.userBlocking) {
            const redisKey = `userBlocking~${userName}`;
            const hasBeenReported = await context.redis.get(redisKey);
            if (!hasBeenReported) {
                const target = await getPostOrCommentById(targetId, context);
                await context.reddit.report(target, {reason: "User may be blocking bot. Check history for subs not modded by Hive Protector."});
            }
            await context.redis.set(redisKey, "true", {expiration: addDays(new Date(), 7)});
        }
        return;
    }

    const settings = await context.settings.getAll();

    // Now check if the submission is of a type configured to be checked.
    // I'm doing this second because it's likely that most subreddits will be configured as "Posts And Comments",
    // So for most cases, we might be able to reduce load by ruling out based on recently cached negative checks first.
    const typesToActOn = (settings[AppSetting.ContentTypeToActOn] as string[] | undefined ?? [ContentTypeToActOn.PostsAndComments])[0] as ContentTypeToActOn;
    if (typesToActOn === ContentTypeToActOn.PostsOnly && targetId.startsWith(ThingPrefix.Comment) || typesToActOn === ContentTypeToActOn.CommentsOnly && targetId.startsWith(ThingPrefix.Post)) {
        // Invalid type of item to check.
        return;
    }

    let user: User | undefined;
    try {
        user = await context.reddit.getUserByUsername(userName);
    } catch {
        //
    }

    if (!user) {
        console.log("User object is not defined. This should be impossible if we checked user.");
        return;
    }

    if (user.isAdmin) {
        console.log(`${userName} is an admin! No action will be taken.`);
        return;
    }

    const userFlairWhitelist = settings[AppSetting.FlairWhitelist] as string | undefined;
    if (userFlairWhitelist) {
        const whitelistedFlairs = userFlairWhitelist.split(",").map(x => x.toLowerCase().trim());
        const userFlair = await user.getUserFlairBySubreddit(subredditName);
        if (userFlair?.flairText && whitelistedFlairs.includes(userFlair.flairText.toLowerCase())) {
            console.log(`User's flair (${userFlair.flairText} is whitelisted. No action will be taken,`);
            return;
        }
    }

    const banEnabled = settings[AppSetting.BanEnabled] as boolean | undefined ?? true;
    const removeEnabled = settings[AppSetting.RemoveEnabled] as boolean | undefined ?? true;
    const reportEnabled = settings[AppSetting.ReportEnabled] as boolean | undefined ?? false;
    const modmailEnabled = settings[AppSetting.ModmailEnabled] as boolean | undefined ?? false;

    const target = await getPostOrCommentById(targetId, context);

    if (banEnabled && problematicItemsResult.userBannable) {
        await banUser(context, subredditName, userName, problematicItemsResult);
    }

    if (!settings[AppSetting.ApplyBanBehavioursToOtherActions] && !problematicItemsResult.userBannable) {
        console.log("Other action options are turned on, but user was previously unbanned. Skipping");
        return;
    }

    if (reportEnabled) {
        let reportReason = settings[AppSetting.ReportTemplate] as string | undefined;
        if (reportReason && !removeEnabled) {
            const whitelistThreshold = settings[AppSetting.ReportNumber] as number | undefined ?? 3;
            let shouldReport = true;
            if (whitelistThreshold) {
                try {
                    const currentApprovalCount = await context.redis.zScore(APPROVALS_KEY, userName);
                    if (currentApprovalCount !== undefined && currentApprovalCount >= whitelistThreshold) {
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
                await context.reddit.report(target, {reason: reportReason});
                await context.redis.set(`itemreported~${targetId}`, new Date().getTime.toString(), {expiration: addDays(new Date(), 7)});
                console.log(`Reported comment ${targetId}`);
            }
        }
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
        const shouldSticky = targetId.startsWith(ThingPrefix.Post) && (settings[AppSetting.StickyReply] as boolean | undefined ?? false);
        await newComment.distinguish(shouldSticky);
        if (settings[AppSetting.LockReply]) {
            await newComment.lock();
        }
        console.log(`Reply left on ${targetId}`);
    }

    if (modmailEnabled) {
        let message = `User /u/${userName} has been identified by Hive Protector as potentially having undesirable history.\n\n`;
        if (problematicItemsResult.badSubs.length > 0) {
            message += `* Problematic Subreddits found: ${problematicItemsResult.badSubs.join(", ")}\n`;
        }

        if (problematicItemsResult.badDomains.length > 0) {
            message += `* Problematic Domains found: ${problematicItemsResult.badDomains.join(", ")}\n`;
        }

        message += `\nUser was caught after making [this post or comment](${target.permalink}).`;

        const appUser = await context.reddit.getAppUser();
        await context.reddit.modMail.createConversation({
            subject: `Hive Protector notice for /u/${userName}`,
            body: message,
            subredditName,
            to: appUser.username,
        });

        console.log("Modmail sent.");
    }
}

function getLatestResultKey (username: string) {
    return `participation-lastcheck-${username}`;
}

interface ProblematicSubsResult {
    badSubs: string[],
    badDomains: string[],
    itemPermalink?: string,
    userBannable: boolean,
    userBlocking: boolean,
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

    return new Date(parseInt(previousBanDateAsString));
}

export interface MockSubItem {
    createdAt: Date,
    subredditName: string,
    url: string,
    permalink: string,
}

export interface BadSubItem {
    item: Post | Comment | MockSubItem,
    foundViaSubreddit: boolean,
    foundViaDomain: boolean,
}

export function isOverThreshold (items: BadSubItem[], combinedThreshold: number, postThreshold: number, commentThreshold: number, minSubCount: number): boolean {
    function isOver (items: BadSubItem[], threshold: number, minSubCount: number): boolean {
        if (items.length < threshold) {
            return false;
        }

        const itemsViaDomainCount = items.filter(x => x.foundViaDomain).length;
        const distinctSubCount = _.uniq(items.filter(item => item.foundViaSubreddit).map(item => item.item.subredditName)).length;

        return itemsViaDomainCount >= threshold || items.length >= threshold && distinctSubCount >= minSubCount;
    }

    if (combinedThreshold && isOver(items, combinedThreshold, minSubCount)) {
        return true;
    }

    if (postThreshold && isOver(items.filter(item => item.item instanceof Post), postThreshold, minSubCount)) {
        return true;
    }

    if (commentThreshold && isOver(items.filter(item => item.item instanceof Comment), commentThreshold, minSubCount)) {
        return true;
    }

    return false;
}

export interface Domain {
    domain: string,
    wildcard: boolean,
}

export function isDomainInList (domain: string, domainList: Domain[]): boolean {
    return domainList.some(item => domain === item.domain || item.wildcard && domain.endsWith(`.${item.domain}`));
}

export async function problematicItemsFound (context: TriggerContext, subredditName: string, userName: string, ignoreCachedResults?: boolean): Promise<ProblematicSubsResult> {
    const emptyResult = {
        badSubs: [],
        badDomains: [],
        userBannable: false,
        userBlocking: false,
    } as ProblematicSubsResult;

    // Shortcut most likely reason for skipping before even retrieving comment or config.
    const lastResult = await lastCheckResult(context, userName);

    if (lastResult && !ignoreCachedResults) {
        console.log(`Most recent check on ${userName} was too recent.`);
        return lastResult;
    }

    const settings = await context.settings.getAll();
    const combinedThreshold = settings[AppSetting.CombinedItemCount] as number | undefined ?? 0;
    const postThreshold = settings[AppSetting.PostCount] as number | undefined ?? 0;
    const commentThreshold = settings[AppSetting.CommentCount] as number | undefined ?? 0;
    const minSubCount = settings[AppSetting.NumberOfSubredditsThatMustMatch] as number | undefined ?? 1;

    if (!combinedThreshold && !postThreshold && !commentThreshold) {
        console.log("No thresholds are defined. Quitting.");
        return emptyResult;
    }

    const userWhitelistSetting = settings[AppSetting.UserWhitelist] as string | undefined;
    if (userWhitelistSetting) {
        const whitelistedUsers = userWhitelistSetting.split(",").map(x => x.trim().toLowerCase());
        if (whitelistedUsers.includes(userName.toLowerCase())) {
            console.log("User is whitelisted.");
            return emptyResult;
        }
    }

    // Get main config and quit if not defined properly.
    const subReddits = settings[AppSetting.Subreddits] as string | undefined ?? "";
    const domains = settings[AppSetting.Domains] as string | undefined ?? "";

    // Convert into an array of lower-case individual sub names
    const subredditList = subReddits.toLowerCase().split(",").map(subName => subName.trim()).filter(subName => subName !== "");

    const domainList = domains.toLowerCase().split(",")
        .map(domain => trimLeadingWWW(domain.trim()))
        .filter(domain => domain !== "")
        .map(domain => ({domain: domain.startsWith("*.") ? domain.replace("*.", "") : domain, wildcard: domain.startsWith("*.")} as Domain));

    if (subredditList.length === 0 && domainList.length === 0) {
        console.log("No subreddits or domains defined.");
        return emptyResult;
    }

    let userContent: (Post | Comment)[] = [];

    const userOverviewOptions = {
        username: userName,
        limit: 100,
        pageSize: 100,
        sort: "new",
    } as GetUserOverviewOptions;

    try {
        if (combinedThreshold || postThreshold && commentThreshold) {
            userContent = await context.reddit.getCommentsAndPostsByUser(userOverviewOptions).all();
        } else if (postThreshold) {
            userContent = await context.reddit.getPostsByUser(userOverviewOptions).all();
        } else if (commentThreshold) {
            userContent = await context.reddit.getCommentsByUser(userOverviewOptions).all();
        }
    } catch {
        console.log(`Error retrieving posts or comments for ${userName}. Likely shadowbanned`);
        return emptyResult;
    }

    let badSubItems = userContent
        .filter(item => item.subredditId !== context.subredditId)
        .map(item => ({
            item,
            foundViaSubreddit: subredditList.includes(item.subredditName.toLowerCase()),
            foundViaDomain: isDomainInList(domainFromUrlString(item.url), domainList),
        } as BadSubItem)).filter(item => item.foundViaDomain || item.foundViaSubreddit);

    let hasMatchingSocialLinks = false;
    const matchingSocialLinksDomains: string[] = [];
    if (settings[AppSetting.CheckSocialLinks] && domainList.length > 0) {
        let user: User | undefined;
        try {
            user = await context.reddit.getUserByUsername(userName);
        } catch {
            //
        }

        if (user) {
            const socialLinks = await user.getSocialLinks();
            matchingSocialLinksDomains.push(...socialLinks.filter(link => isDomainInList(domainFromUrlString(link.outboundUrl), domainList)).map(link => domainFromUrlString(link.outboundUrl)));
            hasMatchingSocialLinks = matchingSocialLinksDomains.length > 0;
        }
    }

    let failsChecks: boolean | undefined;
    let userBannable = false;

    if (badSubItems.length > 0 || hasMatchingSocialLinks) {
        // Filter down further to check the configured thresholds.
        const daysToMonitor = settings[AppSetting.DaysToMonitor] as number | undefined ?? 28;
        badSubItems = badSubItems.filter(item => item.item.createdAt > subDays(new Date(), daysToMonitor));
        failsChecks = hasMatchingSocialLinks || isOverThreshold(badSubItems, combinedThreshold, postThreshold, commentThreshold, minSubCount);

        if (failsChecks) {
            // Over threshold, but user may have been previously banned.
            console.log("User is over the ban threshold. Checking for previous bans.");
            const previousBan = await previousBanDate(context, subredditName, userName);
            if (previousBan) {
                console.log(`User was previously banned at ${previousBan.toISOString()}`);
                const postBanBehaviour = (settings[AppSetting.BehaviourIfPrevBan] as string[] | undefined ?? [PrevBanBehaviour.NeverReBan])[0] as PrevBanBehaviour;

                switch (postBanBehaviour) {
                    case PrevBanBehaviour.NeverReBan:
                        console.log("App is configured to never re-ban.");
                        userBannable = false;
                        break;
                    case PrevBanBehaviour.OnlyRebanIfNewContent:
                        console.log("App is configured to only ban based on content since last ban. Disregarding previous content.");
                        badSubItems = badSubItems.filter(item => item.item.createdAt > previousBan);
                        failsChecks = failsChecks = hasMatchingSocialLinks || isOverThreshold(badSubItems, combinedThreshold, postThreshold, commentThreshold, minSubCount);
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

    const badPostCount = badSubItems.filter(item => item.item instanceof Post).length;
    const badCommentCount = badSubItems.filter(item => item.item instanceof Comment).length;
    const badDomainCount = matchingSocialLinksDomains.length;

    if (badPostCount === 0 && badCommentCount === 0 && domainList.length === 0) {
        console.log(`Found no items of concern for ${userName}.`);
    } else {
        console.log(`Found ${badPostCount} ${pluralize("post", badPostCount)}, ${badCommentCount} ${pluralize("comment", badCommentCount)} and ${badDomainCount} ${pluralize("domain", badDomainCount)} of concern for ${userName}. Over threshold: ${JSON.stringify(failsChecks)}`);
    }

    if (failsChecks) {
        // Now check if user is a mod, approved or previously banned. These are generally unlikely to be
        // true for most subs, so we only do these checks if the user was going to be banned otherwise.
        const skipChecksPromises: Promise<boolean>[] = [isModerator(context, subredditName, userName)];
        if (settings[AppSetting.ExemptApprovedUser]) {
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
        result = {
            badSubs: _.uniq(badSubItems.filter(item => item.foundViaSubreddit).map(item => item.item.subredditName)),
            badDomains: _.uniq([...matchingSocialLinksDomains, ...badSubItems.filter(item => item.foundViaDomain).map(item => domainFromUrlString(item.item.url))]),
            itemPermalink: badSubItems[0]?.item.permalink,
            userBannable,
            userBlocking: false,
        } as ProblematicSubsResult;
    } else {
        if (settings[AppSetting.AntiBlockCheckerEnable]) {
            const isBlocking = await isUserBlockingAppAccount(userContent, context);
            if (isBlocking) {
                console.log(`User ${userName} may be blocking Hive Protector!`);
                result = {
                    badDomains: [],
                    badSubs: [],
                    userBannable: false,
                    userBlocking: true,
                } as ProblematicSubsResult;
            } else {
                result = emptyResult;
            }
        } else {
            result = emptyResult;
        }
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
        reason: banReason.slice(0, 100),
        message: banMessage?.slice(0, 1000),
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

async function appUserIsModOfSub (username: string, subredditName: string, context: TriggerContext): Promise<boolean> {
    const redisKey = `appUserIsModOf~${subredditName}`;
    const cachedValue = await context.redis.get(redisKey);
    if (cachedValue) {
        return JSON.parse(cachedValue) as boolean;
    }

    const isMod = await isModerator(context, subredditName, username);
    console.log(`App account mod of ${subredditName}? ${isMod}`);

    await context.redis.set(redisKey, JSON.stringify(isMod), {expiration: addDays(new Date(), 7)});
    return isMod;
}

async function isUserBlockingAppAccount (userHistory: (Post | Comment)[], context: TriggerContext): Promise<boolean> {
    if (userHistory.length < 20) {
        // Immature account, may not have accrued enough history to be reasonably confident about blocking.
        return false;
    }

    const subreddits = _.uniq(userHistory.filter(x => x.subredditId !== context.subredditId).map(x => x.subredditName));
    if (subreddits.length === 0) {
        return false;
    }

    const appUser = await getAppName(context);
    for (const subreddit of subreddits) {
        const isModOfSub = await appUserIsModOfSub(appUser, subreddit, context);
        if (!isModOfSub) {
            return false;
        }
    }

    if (subreddits.length < 3) {
        // Too few subreddits to determine if they may be blocking.
        return false;
    }

    const user = await userHistory[0].getAuthor();
    if (user) {
        if (user.createdAt > subMonths(new Date(), 1)) {
            // Immature account, may not have accrued enough history to be reasonably confident about blocking.
            return false;
        }
    }

    return true;
}
