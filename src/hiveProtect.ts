import {TriggerContext, Post, Comment, OnTriggerEvent} from "@devvit/public-api";
import {CommentSubmit, PostSubmit} from "@devvit/protos";
import {addDays, addHours} from "date-fns";
import {isModerator, isContributor} from "./utility.js";
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
    const exemptApprovedUsers = await context.settings.get<boolean>("exemptapproveduser");
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

async function userWasPreviouslyBanned (context: TriggerContext, userName: string): Promise<boolean> {
    const wasPreviouslyBanned = await context.redis.get(`participation-prevbanned-${userName}`);
    return wasPreviouslyBanned !== undefined && wasPreviouslyBanned !== "";
}

async function problematicSubsFound (context: TriggerContext, userName: string): Promise<string[]> {
    // Shortcut most likely reason for skipping before even retrieving comment or config.
    const wasLastCheckTooRecent = await lastCheckTooRecent(context, userName);
    if (wasLastCheckTooRecent) {
        console.log(`Most recent check on ${userName} was too recent. Quitting.`);
        return [];
    }

    // Get main config and quit if not defined properly.
    const subReddits = await context.settings.get<string>("subreddits");
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
        console.log("Error retrieving user's posts or comments. Likely shadowbanned");
        console.log(error);
        userContent = [];
    }

    let badSubItems = userContent.filter(item => subredditList.includes(item.subredditName.toLowerCase()));
    let failsChecks: boolean | undefined;

    if (badSubItems.length > 0) {
        // Filter down further to check the configured thresholds. If there was nothing for the user,
        // there is no point even getting these config values.
        const threshold = await context.settings.get<number>("itemcount") ?? 6;
        const daysToMonitor = await context.settings.get<number>("daystomonitor") ?? 28;
        badSubItems = badSubItems.filter(item => item.createdAt > addDays(new Date(), -daysToMonitor));
        failsChecks = badSubItems.length >= threshold;
    } else {
        failsChecks = false;
    }

    console.log(`Found ${badSubItems.length} item(s) of content in monitored subreddits for ${userName}`);

    if (failsChecks) {
        // Now check if user is a mod, approved or previously banned. These are generally unlikely to be
        // true for most subs, so we only do these checks if the user was going to be banned otherwise.
        const subreddit = await context.reddit.getCurrentSubreddit();
        const reasonsToSkipChecks = await Promise.all([
            isModerator(context, subreddit.name, userName),
            userApproved(context, subreddit.name, userName),
            userWasPreviouslyBanned(context, userName),
        ]);

        // If any check returns "True", user isn't eligible to be checked.
        if (reasonsToSkipChecks.includes(true)) {
            console.log(`User ${userName} is not eligible for checks (mod, approved or prev banned)`);
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
    let banMessage = await context.settings.get<string>("banmessage");
    if (banMessage) {
        banMessage = banMessage.replace("{{sublist}}", badSubs.join(", "));
    }
    const banNote = await context.settings.get<string>("bannote");

    const subreddit = await context.reddit.getCurrentSubreddit();

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
        subredditName: subreddit.name,
    });

    console.log(`Banned ${userName} from ${subreddit.name}`);
}
