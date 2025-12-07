import { JobContext, JSONObject, ScheduledJobEvent, TriggerContext, User, ZMember } from "@devvit/public-api";
import { addDays, addMinutes, addSeconds } from "date-fns";
import { APPROVALS_KEY } from "./handleContentCreation.js";
import { compact, uniq } from "lodash";

export const CLEANUP_LOG_KEY = "cleanupStore";
const DAYS_BETWEEN_CHECKS = 28;

export async function setCleanupForUser (username: string, context: TriggerContext | JobContext) {
    await context.redis.zAdd(CLEANUP_LOG_KEY, { member: username, score: addDays(new Date(), DAYS_BETWEEN_CHECKS).getTime() });
}

async function userActive (username: string, context: JobContext): Promise<boolean> {
    let user: User | undefined;
    try {
        user = await context.reddit.getUserByUsername(username);
    } catch {
        //
    }

    if (!user) {
        try {
            await context.reddit.getModNotes({
                subreddit: context.subredditName ?? await context.reddit.getCurrentSubredditName(),
                user: username,
            }).all();
        } catch {
            // If mod notes retrieval fails, we assume the user is deleted. Otherwise suspended or shadowbanned.
            return false;
        }
    }

    return true;
}

export async function cleanupDeletedAccounts (event: ScheduledJobEvent<JSONObject | undefined>, context: JobContext) {
    console.log("Cleanup: Starting cleanup job");
    const usersDueACheck = await context.redis.zRange(CLEANUP_LOG_KEY, 0, new Date().getTime(), { by: "score" }).then(items => items.map(item => item.member));
    if (usersDueACheck.length === 0) {
        // No user accounts need to be checked.
        console.log("Cleanup: No users are due a check.");
        return;
    }

    // Grab the app account's user to ensure that platform is stable.
    await context.reddit.getAppUser();

    const runLimit = addSeconds(new Date(), 10);

    const recentlyRunKey = "cleanupRecentlyRun";
    if (event.data?.fromCron && await context.redis.exists(recentlyRunKey)) {
        return;
    }
    await context.redis.set(recentlyRunKey, "true", { expiration: addMinutes(new Date(), 1) });

    while (new Date() < runLimit && usersDueACheck.length > 0) {
        const username = usersDueACheck.shift();
        if (!username) {
            break;
        }

        if (await userActive(username, context)) {
            await setCleanupForUser(username, context);
            console.log(`Cleanup: User ${username} is still active. Rescheduled check.`);
            continue;
        }

        // User is deleted. Remove from cleanup log and remove previous records of bans and approvals.
        await context.redis.zRem(APPROVALS_KEY, [username]);
        await context.redis.del(`participation-prevbanned-${username}`);
        await context.redis.del(`modNoteAdded:${username}`);
        await context.redis.del(`repliesMade:${username}`);
        await context.redis.del(`userExempt:${username}`);
        await context.redis.del(`antiBlockModNoteAdded~${username}`);
        await context.redis.zRem(CLEANUP_LOG_KEY, [username]);
        console.log(`Cleanup: User ${username} appears to be deleted. Removed from data store.`);
    }

    // If there were more users in this run than we could process, schedule another run immediately.
    if (usersDueACheck.length > 0) {
        await context.scheduler.runJob({
            name: "cleanupDeletedAccounts",
            runAt: addSeconds(new Date(), 5),
        });
    }
}

/**
 * Grab as many users previously banned by this user as we can, and add to cleanup list.
 */
export async function addCleanupEntriesForBannedAccounts (context: TriggerContext) {
    const subredditName = context.subredditName ?? (await context.reddit.getCurrentSubreddit()).name;
    const modLog = await context.reddit.getModerationLog({
        subredditName,
        moderatorUsernames: [context.appName],
        type: "banuser",
        limit: 1000,
    }).all();

    const userList = uniq(compact(modLog.filter(entry => entry.target).map(entry => entry.target?.author))).filter(username => username !== "[deleted]");
    if (userList.length === 0) {
        return;
    }

    // Store users with random times throughout the day to spread out workload.
    await context.redis.zAdd(CLEANUP_LOG_KEY, ...userList.map(user => ({ member: user, score: addMinutes(new Date(), Math.random() * 60 * 24 * 2).getTime() } as ZMember)));
    console.log(`Cleanup: ${userList.length} previously banned users added to the cleanup store`);
}

export async function rescheduleCleanupEntries (context: TriggerContext) {
    const redisKey = "prevTimeBetweenChecks";
    const prevTimeBetweenChecks = await context.redis.get(redisKey);

    if (JSON.stringify(DAYS_BETWEEN_CHECKS) === prevTimeBetweenChecks) {
        return;
    }

    const currentCleanupEntries = await context.redis.zRange(CLEANUP_LOG_KEY, 0, -1);

    if (currentCleanupEntries.length === 0) {
        return;
    }

    // Store users with random times throughout the day to spread out workload.
    await context.redis.zAdd(CLEANUP_LOG_KEY, ...currentCleanupEntries.map(user => ({ member: user.member, score: addMinutes(new Date(), Math.random() * 60 * 24 * DAYS_BETWEEN_CHECKS).getTime() } as ZMember)));
    console.log(`Cleanup: ${currentCleanupEntries.length} Cleanup users rescheduled.`);

    await context.redis.set(redisKey, JSON.stringify(DAYS_BETWEEN_CHECKS));
}
