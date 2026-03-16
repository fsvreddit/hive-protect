import { JobContext, JSONObject, ScheduledJobEvent, TriggerContext, User } from "@devvit/public-api";
import { addDays, addMinutes, addSeconds } from "date-fns";
import { APPROVALS_KEY } from "./handleContentCreation.js";

const CLEANUP_LOG_KEY = "cleanupStore";
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

        // Delete the "previously banned" record in all cases, because bans are no longer supported.
        await context.redis.del(`participation-prevbanned-${username}`);

        if (await userActive(username, context)) {
            await setCleanupForUser(username, context);
            console.log(`Cleanup: User ${username} is still active. Rescheduled check.`);
            continue;
        }

        // User is deleted. Remove from cleanup log and remove previous records of bans and approvals.
        await context.redis.zRem(APPROVALS_KEY, [username]);
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
