import {TriggerContext, Post, Comment} from "@devvit/public-api";
import {CommentSubmit, PostSubmit} from "@devvit/protos";
import {addDays, addHours} from "date-fns";
import {isModerator, isContributor, getSubredditName, getAppName, replaceAll, ThingPrefix} from "./utility.js";
import {AppSetting, PrevBanBehaviour} from "./settings.js";
import _ from "lodash";

export async function handlePostSubmitEvent (event: PostSubmit, context: TriggerContext) {
    if (!event.author || !event.author.name || !event.post || event.author.id === context.appAccountId) {
        console.log("Event is not in the right state.");
        return;
    }

    await handlePostOrCommentSubmitEvent(event.post.id, event.author.name, context);
}

export async function handleCommentSubmitEvent (event: CommentSubmit, context: TriggerContext) {
    if (!event.author || !event.author.name || !event.comment || event.author.id === context.appAccountId) {
        console.log("Event is not in the right state.");
        return;
    }

    await handlePostOrCommentSubmitEvent(event.comment.id, event.author.name, context);
}

export async function handlePostOrCommentSubmitEvent (targetId: string, userName: string, context: TriggerContext) {
    const problematicSubsResult = await problematicSubsFound(context, userName);

    if (problematicSubsResult.badSubs.length === 0) {
        return;
    }

    const settings = await context.settings.getAll();
    const banEnabled = settings[AppSetting.BanEnabled] as boolean ?? true;
    const removeEnabled = settings[AppSetting.RemoveEnabled] as boolean ?? true;
    const reportEnabled = settings[AppSetting.ReportEnabled] as boolean ?? false;

    if (banEnabled && problematicSubsResult.userBannable) {
        await banUser(context, userName, problematicSubsResult.badSubs);
    }

    if (removeEnabled) {
        await context.reddit.remove(targetId, true);
        console.log(`Removed item ${targetId}`);
        let removalReason = settings[AppSetting.RemovalReasonTemplate] as string | undefined;
        if (removalReason) {
            removalReason = replaceAll(removalReason, "{{sublist}}", problematicSubsResult.badSubs.join(", "));
            removalReason = replaceAll(removalReason, "{{username}}", userName);
            const newComment = await context.reddit.submitComment({id: targetId, text: removalReason});
            const shouldSticky = targetId.startsWith(ThingPrefix.Post);
            await Promise.all([
                newComment.distinguish(shouldSticky),
                newComment.lock(),
            ]);
            console.log(`Removal reason left on ${targetId}`);
        }
    }

    if (reportEnabled) {
        let reportReason = settings[AppSetting.ReportTemplate] as string | undefined;
        if (reportReason && !removeEnabled) {
            reportReason = replaceAll(reportReason, "{{sublist}}", problematicSubsResult.badSubs.join(", "));
            let target: Post | Comment;
            if (targetId.startsWith(ThingPrefix.Post)) {
                target = await context.reddit.getPostById(targetId);
            } else {
                target = await context.reddit.getCommentById(targetId);
            }
            await context.reddit.report(target, {reason: reportReason});
            console.log(`Reported comment ${targetId}`);
        }
    }
}

interface ProblematicSubsResult {
    badSubs: string[],
    userBannable: boolean,
}

async function lastCheckResult (context: TriggerContext, userName: string): Promise<ProblematicSubsResult | undefined> {
    const redisKey = `participation-recentresult-${userName}`;
    const recentCheckValue = await context.redis.get(redisKey);

    if (!recentCheckValue) {
        return;
    }

    return JSON.parse(recentCheckValue) as ProblematicSubsResult;
}

async function previousBanDate (context: TriggerContext, userName: string): Promise<Date | undefined> {
    const redisKey = `participation-prevbanned-${userName}`;
    const previousBanDateAsString = await context.redis.get(redisKey);
    if (!previousBanDateAsString) {
        return;
    }

    try {
        // Attempt to parse the value. This will work for any bans in recent versions of the app.
        const banDate = new Date(parseInt(previousBanDateAsString));
        return banDate;
    } catch {
        console.log(`Error converting value ${previousBanDateAsString} found in Redis. Falling back on mod log.`);
    }

    // Very early versions of this app stored a simple boolean in the KV Store. Attempt to determine via mod log.
    const subredditName = await getSubredditName(context);
    const appName = await getAppName(context);

    let modLog = await context.reddit.getModerationLog({
        subredditName,
        moderatorUsernames: [appName],
        type: "banuser",
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

async function problematicSubsFound (context: TriggerContext, userName: string): Promise<ProblematicSubsResult> {
    const emptyResult = <ProblematicSubsResult>{
        badSubs: [],
        userBannable: false,
    };

    // Shortcut most likely reason for skipping before even retrieving comment or config.
    const lastResult = await lastCheckResult(context, userName);

    if (lastResult) {
        console.log(`Most recent check on ${userName} was too recent. Quitting using previous result value.`);
        return lastResult;
    }

    const settings = await context.settings.getAll();

    // Get main config and quit if not defined properly.
    const subReddits = settings[AppSetting.Subreddits] as string | undefined;
    if (!subReddits) {
        console.log("Subreddit list not defined.");
        return emptyResult;
    }

    // Convert into an array of lower-case individual sub names
    const subredditList = subReddits.toLowerCase().split(",").map(subName => subName.trim());

    let userContent: (Post | Comment)[] | undefined;
    try {
        userContent = await context.reddit.getCommentsAndPostsByUser({
            username: userName,
            limit: 100,
            pageSize: 100,
            sort: "new",
        }).all();
    } catch (error) {
        console.log(`Error retrieving posts or comments for ${userName}. Likely shadowbanned`);
        console.log(error);
        userContent = [];
        // Note: We deliberately don't return an empty array here, because we still want to set last check date.
    }

    let badSubItems = userContent.filter(item => item.subredditId !== context.subredditId && subredditList.includes(item.subredditName.toLowerCase()));
    let failsChecks: boolean | undefined;
    let userBannable = false;

    if (badSubItems.length > 0) {
        // Filter down further to check the configured thresholds. If there was nothing for the user,
        // there is no point even getting these config values.
        const threshold = settings[AppSetting.ItemCount] as number ?? 6;
        const daysToMonitor = settings[AppSetting.DaysToMonitor] as number ?? 28;
        badSubItems = badSubItems.filter(item => item.createdAt > addDays(new Date(), -daysToMonitor));
        failsChecks = badSubItems.length >= threshold;

        if (failsChecks) {
            // Over threshold, but user may have been previously banned.
            console.log("User is over the ban threshold. Checking for previous bans.");
            const previousBan = await previousBanDate(context, userName);
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
                        failsChecks = badSubItems.length >= threshold;
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

    console.log(`Found ${badSubItems.length} item(s) of content in monitored subreddits for ${userName}`);

    if (failsChecks) {
        // Now check if user is a mod, approved or previously banned. These are generally unlikely to be
        // true for most subs, so we only do these checks if the user was going to be banned otherwise.
        const subredditName = await getSubredditName(context);
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
            badSubs: _.uniq(badSubItems.map(item => item.subredditName)),
            userBannable,
        };
    } else {
        result = emptyResult;
    }

    // Store record of last time checked
    const now = new Date().getTime();
    await context.redis.set(`participation-recentresult-${userName}`, JSON.stringify(result), {expiration: addHours(now, 2)});

    return result;
}

async function banUser (context: TriggerContext, userName: string, badSubs: string[]): Promise<void> {
    const settings = await context.settings.getAll();

    let banMessage = settings[AppSetting.BanMessage] as string | undefined;
    if (banMessage) {
        banMessage = banMessage.replace("{{sublist}}", badSubs.join(", "));
        banMessage = banMessage.replace("{{username}}", userName);
    }
    const banNote = settings[AppSetting.BanNote] as string | undefined;

    const subredditName = await getSubredditName(context);

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

    await context.reddit.banUser({
        username: userName,
        reason: banReason.replace("{{sublist}}", badSubs.join(", ")),
        message: banMessage,
        subredditName,
        duration: banDuration,
    });

    await context.redis.set(`participation-prevbanned-${userName}`, new Date().getTime().toString());

    console.log(`Banned ${userName} from ${subredditName}`);
}
