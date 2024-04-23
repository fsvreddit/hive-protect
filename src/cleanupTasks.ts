import {ScheduledJobEvent, TriggerContext, ZMember} from "@devvit/public-api";
import {addDays, addMinutes} from "date-fns";
import {APPROVALS_KEY} from "./hiveProtect.js";
import _ from "lodash";

export const CLEANUP_LOG_KEY = "cleanupStore";

export async function setCleanupForUser (username: string, context: TriggerContext) {
    await context.redis.zAdd(CLEANUP_LOG_KEY, {member: username, score: addDays(new Date(), 2).getTime()});
}

async function userActive (username: string, context: TriggerContext): Promise<boolean> {
    try {
        await context.reddit.getUserByUsername(username);
        return true;
    } catch (error) {
        if (error instanceof Error) {
            if (error.stack && error.stack.includes("404 Not Found")) {
                // Deleted or shadowbanned
                console.log(`Cleanup: ${username} appears to be deleted or shadowbanned.`);
                return false;
            }
        }
        // Other errors may be platform errors. In those cases we do not want to remove the data.
        return true;
    }
}

interface UserActive {
    username: string,
    isActive: boolean,
}

export async function cleanupDeletedAccounts (_: ScheduledJobEvent, context: TriggerContext) {
    console.log("Cleanup: Starting cleanup job");
    const items = await context.redis.zRange(CLEANUP_LOG_KEY, 0, new Date().getTime(), {by: "score"});
    if (items.length === 0) {
        // No user accounts need to be checked.
        console.log("Cleanup: No users are due a check.");
        return;
    }

    const itemsToCheck = 50;

    if (items.length > itemsToCheck) {
        console.log(`Cleanup: ${items.length} accounts are due a check. Checking first ${itemsToCheck} in this run.`);
    } else {
        console.log(`Cleanup: ${items.length} accounts are due a check.`);
    }

    // Get the first N accounts that are due a check.
    const usersToCheck = items.slice(0, itemsToCheck).map(item => item.member);
    const userStatuses: UserActive[] = [];

    for (const username of usersToCheck) {
        // eslint-disable-next-line no-await-in-loop
        const isActive = await userActive(username, context);
        userStatuses.push(<UserActive>{username, isActive});
    }

    const activeUsers = userStatuses.filter(user => user.isActive).map(user => user.username);
    const deletedUsers = userStatuses.filter(user => !user.isActive).map(user => user.username);

    // For active users, set their next check date to be one day from now.
    if (activeUsers.length > 0) {
        console.log(`Cleanup: ${activeUsers.length} users still active out of ${userStatuses.length}. Resetting next check time.`);
        await context.redis.zAdd(CLEANUP_LOG_KEY, ...activeUsers.map(user => <ZMember>{member: user, score: addDays(new Date(), 1).getTime()}));
    }

    // For deleted users, remove them from both the cleanup log and remove previous records of bans and approvals.
    if (deletedUsers.length > 0) {
        console.log(`Cleanup: ${deletedUsers.length} users out of ${userStatuses.length} are deleted or suspended. Removing from data store.`);
        await context.redis.zRem(APPROVALS_KEY, deletedUsers);
        await Promise.all(deletedUsers.map(user => context.redis.del(`participation-prevbanned-${user}`)));
        await context.redis.zRem(CLEANUP_LOG_KEY, deletedUsers);
    }
}

/**
 * Grab as many users previously banned by this user as we can, and add to cleanup list.
 */
export async function addCleanupEntriesForBannedAccounts (context: TriggerContext) {
    const subreddit = await context.reddit.getCurrentSubreddit();
    const thisApp = await context.reddit.getAppUser();
    const modLog = await context.reddit.getModerationLog({
        subredditName: subreddit.name,
        moderatorUsernames: [thisApp.username],
        type: "banuser",
        limit: 1000,
    }).all();

    const userList = _.uniq(_.compact(modLog.filter(entry => entry.target).map(entry => entry.target?.author))).filter(username => username !== "[deleted]");
    if (userList.length === 0) {
        return;
    }

    // Store users with random times throughout the day to spread out workload.
    await context.redis.zAdd(CLEANUP_LOG_KEY, ...userList.map(user => <ZMember>{member: user, score: addMinutes(new Date(), Math.random() * 60 * 24 * 2).getTime()}));
    console.log(`Cleanup: ${userList.length} previously banned users added to the cleanup store`);
}
