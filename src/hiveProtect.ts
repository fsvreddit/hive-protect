import {TriggerContext, Post, Comment, OnTriggerEvent} from "@devvit/public-api";
import {CommentSubmit, PostSubmit} from "@devvit/protos";
import {addDays, addHours} from "date-fns";
import {isModerator, isContributor, getSubredditName, getAppName} from "./utility.js";
import {AppSetting, PrevBanBehaviour} from "./settings.js";
import _ from "lodash";

export async function handlePostOrCommentSubmitEvent (event: OnTriggerEvent<CommentSubmit | PostSubmit>, context: TriggerContext) {
    if (!event.author || !event.author.name) {
        console.log("Author not defined");
        return;
    }

    const badSubs = await problematicSubsFound(context, event.author.name);

    if (badSubs.length === 0) {
        return;
    }

    let targetId: string | undefined;

    if (event.type === "CommentSubmit") {
        const commentEvent = event as OnTriggerEvent<CommentSubmit>;
        if (!commentEvent.comment) {
            return;
        }
        targetId = commentEvent.comment.id;
    } else {
        if (!event.post) {
            return;
        }
        targetId = event.post.id;
    }

    await Promise.all([
        banUser(context, event.author.name, badSubs),
        context.redis.set(`participation-prevbanned-${event.author.name}`, new Date().getTime().toString()),
        context.reddit.remove(targetId, true),
    ]);

    console.log(`Removed item ${targetId}`);
}

async function userApproved (context: TriggerContext, subName: string, userName: string): Promise<boolean> {
    const exemptApprovedUsers = await context.settings.get<boolean>(AppSetting.ExemptApprovedUser);
    if (exemptApprovedUsers) {
        return isContributor(context, subName, userName);
    } else {
        return false;
    }
}

async function lastCheckTooRecent (context: TriggerContext, userName: string): Promise<boolean> {
    const recentCheck = await context.redis.get(`participation-recentcheck-${userName}`);
    return recentCheck !== undefined && recentCheck !== "";
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

async function problematicSubsFound (context: TriggerContext, userName: string): Promise<string[]> {
    // Shortcut most likely reason for skipping before even retrieving comment or config.
    const wasLastCheckTooRecent = await lastCheckTooRecent(context, userName);
    if (wasLastCheckTooRecent) {
        console.log(`Most recent check on ${userName} was too recent. Quitting.`);
        return [];
    }

    // Get main config and quit if not defined properly.
    const subReddits = await context.settings.get<string>(AppSetting.Subreddits);
    if (!subReddits) {
        console.log("Subreddit list not defined.");
        return [];
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

    if (badSubItems.length > 0) {
        // Filter down further to check the configured thresholds. If there was nothing for the user,
        // there is no point even getting these config values.
        const threshold = await context.settings.get<number>(AppSetting.ItemCount) ?? 6;
        const daysToMonitor = await context.settings.get<number>(AppSetting.DaysToMonitor) ?? 28;
        badSubItems = badSubItems.filter(item => item.createdAt > addDays(new Date(), -daysToMonitor));
        failsChecks = badSubItems.length >= threshold;

        if (failsChecks) {
            // Over threshold, but user may have been previously banned.
            console.log("User is over the ban threshold. Checking for previous bans.");
            const previousBan = await previousBanDate(context, userName);
            if (previousBan) {
                console.log(`User was previously banned at ${previousBan.toISOString()}`);
                const postBanBehaviour = await context.settings.get<string[]>(AppSetting.BehaviourIfPrevBan) ?? [PrevBanBehaviour.NeverReBan];

                switch (postBanBehaviour[0]) {
                    case PrevBanBehaviour.NeverReBan:
                        console.log("App is configured to never re-ban.");
                        failsChecks = false;
                        break;
                    case PrevBanBehaviour.OnlyRebanIfNewContent:
                        console.log("App is configured to only ban based on content since last ban. Disregarding previous content.");
                        badSubItems = badSubItems.filter(item => item.createdAt > previousBan);
                        failsChecks = badSubItems.length >= threshold;
                        break;
                    case PrevBanBehaviour.AlwaysReBan:
                        console.log("App is configured to always re-ban.");
                        break;
                }
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
        const reasonsToSkipChecks = await Promise.all([
            isModerator(context, subredditName, userName),
            userApproved(context, subredditName, userName),
        ]);

        // If any check returns "True", user isn't eligible to be checked.
        if (reasonsToSkipChecks.includes(true)) {
            console.log(`User ${userName} is not due a ban (mod or approved)`);
            failsChecks = false;
        }
    }

    // Store record of last time checked
    const now = new Date().getTime();
    await context.redis.set(`participation-recentcheck-${userName}`, now.toString(), {expiration: addHours(now, 2)});

    if (failsChecks) {
        return _.uniq(badSubItems.map(item => item.subredditName));
    }

    return [];
}

async function banUser (context: TriggerContext, userName: string, badSubs: string[]): Promise<void> {
    let banMessage = await context.settings.get<string>(AppSetting.BanMessage);
    if (banMessage) {
        banMessage = banMessage.replace("{{sublist}}", badSubs.join(", "));
    }
    const banNote = await context.settings.get<string>(AppSetting.BanNote);

    const subredditName = await getSubredditName(context);

    let banDuration = await context.settings.get<number>(AppSetting.BanDuration);
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

    console.log(`Banned ${userName} from ${subredditName}`);
}
