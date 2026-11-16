import { context, reddit, redis, scheduler, settings, TaskRequest, User } from "@devvit/web/server";
import { addDays, addMinutes, addSeconds } from "date-fns";
import { APPROVALS_KEY, AppSetting, SchedulerJob } from ".";
import { hasEventBeenHandled } from "@fsvreddit/fsv-devvit-web-helpers";
import { CleanupDeletedAccountsJobData } from "../tasks";

const CLEANUP_LOG_KEY = "cleanupStore";
const DAYS_BETWEEN_CHECKS = 28;

export async function setCleanupForUser (username: string) {
    await redis.zAdd(CLEANUP_LOG_KEY, { member: username, score: addDays(new Date(), DAYS_BETWEEN_CHECKS).getTime() });
}

async function userActive (username: string): Promise<boolean> {
    let user: User | undefined;
    try {
        user = await reddit.getUserByUsername(username);
    } catch {
        //
    }

    if (!user) {
        try {
            await reddit.getModNotes({
                subreddit: context.subredditName,
                user: username,
            }).all();
        } catch {
            // If mod notes retrieval fails, we assume the user is deleted. Otherwise suspended or shadowbanned.
            return false;
        }
    }

    return true;
}

export async function cleanupDeletedAccounts (event: TaskRequest<CleanupDeletedAccountsJobData>) {
    const jobGuid = event.data.jobGuid;
    if (jobGuid && await hasEventBeenHandled(`job:${jobGuid}`, { expiration: addMinutes(new Date(), 5) })) {
        console.warn(`Cleanup: Job ${jobGuid} has already been handled. Skipping.`);
        return;
    }

    if (!jobGuid && await hasEventBeenHandled(`job:cleanupDeletedAccounts`, { expiration: addSeconds(new Date(), 30) })) {
        console.warn(`Cleanup: Job without GUID has already been handled. Skipping.`);
        return;
    }

    console.log("Cleanup: Starting cleanup job");
    const verboseLogs = await settings.get<boolean>(AppSetting.VerboseLogs);

    const usersDueACheck = await redis.zRange(CLEANUP_LOG_KEY, 0, new Date().getTime(), { by: "score" }).then(items => items.map(item => item.member));
    if (usersDueACheck.length === 0) {
        // No user accounts need to be checked.
        if (verboseLogs) {
            console.log("Cleanup: No users are due a check.");
        }
        return;
    }

    // Grab the app account's user to ensure that platform is stable.
    await reddit.getAppUser();

    const runLimit = addSeconds(new Date(), 10);

    const recentlyRunKey = "cleanupOngoing";
    if (event.data.fromCron && await redis.exists(recentlyRunKey)) {
        return;
    }
    await redis.set(recentlyRunKey, "true", { expiration: addMinutes(new Date(), 1) });

    while (new Date() < runLimit && usersDueACheck.length > 0) {
        const username = usersDueACheck.shift();
        if (!username) {
            break;
        }

        // Delete the "previously banned" record in all cases, because bans are no longer supported.
        await redis.del(`participation-prevbanned-${username}`);

        if (await userActive(username)) {
            await setCleanupForUser(username);
            if (verboseLogs) {
                console.log(`Cleanup: User ${username} is still active. Rescheduled check.`);
            }
            continue;
        }

        // User is deleted. Remove from cleanup log and remove previous records of bans and approvals.
        await redis.zRem(APPROVALS_KEY, [username]);
        await redis.del(`modNoteAdded:${username}`, `repliesMade:${username}`, `userExempt:${username}`, `antiBlockModNoteAdded~${username}`);
        await redis.zRem(CLEANUP_LOG_KEY, [username]);
        console.log(`Cleanup: User ${username} appears to be deleted. Removed from data store.`);
    }

    // If there were more users in this run than we could process, schedule another run immediately.
    if (usersDueACheck.length > 0) {
        await scheduler.runJob({
            name: SchedulerJob.CleanupDeletedAccounts,
            runAt: addSeconds(new Date(), 5),
            data: { jobGuid: crypto.randomUUID() },
        });
    }
}
