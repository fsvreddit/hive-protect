import { context, reddit, redis, scheduler, settings, SettingsValues, TaskRequest } from "@devvit/web/server";
import { isT1, isT3, T1, T3 } from "@devvit/web/shared";
import { addDays, addHours, addMinutes, addSeconds } from "date-fns";
import { actionUser, AppSetting, cancelCheckUserJobIfQueueEmpty, ContentTypeToActOn, createCheckUserJobIfNotPresent, createCronJobsIfNotPresent, problematicItemsFound, SchedulerJob, setCleanupForUser } from ".";
import pluralize from "pluralize";
import { getPostOrCommentById, hasEventBeenHandled } from "@fsvreddit/fsv-devvit-web-helpers";
import { ProcessUserCheckQueueData } from "../tasks";

export const APPROVALS_KEY = "ItemApprovalCount";

export const CHECK_QUEUE_KEY = "UserCheckQueue";

async function addUserToQueue (targetId: T1 | T3, username: string) {
    await redis.zAdd(CHECK_QUEUE_KEY, { member: `${username}:${targetId}`, score: addSeconds(new Date(), 30).getTime() });
    await createCheckUserJobIfNotPresent();
}

export async function removeQueuedEntriesOlderThan (cutoffDate: Date) {
    const removedCount = await redis.zRemRangeByScore(CHECK_QUEUE_KEY, 0, cutoffDate.getTime());
    if (removedCount > 0) {
        console.log(`Removed ${removedCount} entries from user check queue older than ${cutoffDate.toISOString()}.`);
    }
}

export async function handlePostOrCommentSubmitEvent (targetId: T1 | T3, userName: string) {
    if (userName === "AutoModerator" || userName === "automod-neo" || userName === `${context.subredditName}-ModTeam` || userName === context.appSlug) {
        // Automod could legitimately have activity in "bad" subreddits, but we never want to act on it.
        return false;
    }

    await addUserToQueue(targetId, userName);

    const lastJobCheckKey = "LastJobsChecked";
    if (!await redis.exists(lastJobCheckKey)) {
        await createCronJobsIfNotPresent();
        await redis.set(lastJobCheckKey, "", { expiration: addHours(new Date(), 1) });
    }
}

export async function checkUserFromQueue (username: string, targetId: T1 | T3, settings: SettingsValues) {
    const kind = isT3(targetId) ? "link" : "comment";
    const problematicItemsResult = await problematicItemsFound(username, kind, targetId, settings);

    if (problematicItemsResult.badSubs.length === 0 && problematicItemsResult.badDomains.length === 0) {
        if (problematicItemsResult.userBlocking) {
            const redisKey = `userIsBlocking~${username}`;
            const hasBeenReported = await redis.get(redisKey);
            if (!hasBeenReported) {
                const target = await getPostOrCommentById(targetId);
                await reddit.report(target, { reason: "User may be blocking bot. Check history for subs not modded by Hive Protector." });
            }
            await redis.set(redisKey, "true", { expiration: addDays(new Date(), 7) });

            if (settings[AppSetting.AntiBlockCheckerAddModNote]) {
                const modNoteKey = `antiBlockModNoteAdded~${username}`;
                if (!await redis.exists(modNoteKey)) {
                    await reddit.addModNote({
                        subreddit: context.subredditName,
                        user: username,
                        note: "User may be blocking Hive Protector",
                        label: "SPAM_WARNING",
                    });
                    await redis.set(modNoteKey, "true");
                    await setCleanupForUser(username);
                }
            }
        }
        return;
    }

    const redisKey = `alreadyChecked~${targetId}`;
    const alreadyChecked = await redis.exists(redisKey);
    if (alreadyChecked) {
        console.log(`Duplicate event fired for ${targetId}`);
        return;
    }
    await redis.set(redisKey, "", { expiration: addHours(new Date(), 6) });

    // Now check if the submission is of a type configured to be checked.
    // I'm doing this second because it's likely that most subreddits will be configured as "Posts And Comments",
    // So for most cases, we might be able to reduce load by ruling out based on recently cached negative checks first.
    const typesToActOn = (settings[AppSetting.ContentTypeToActOn] as ContentTypeToActOn[] | undefined ?? [ContentTypeToActOn.PostsAndComments])[0];
    if ((typesToActOn === ContentTypeToActOn.PostsOnly && isT1(targetId)) || (typesToActOn === ContentTypeToActOn.CommentsOnly && isT3(targetId))) {
        // Invalid type of item to check.
        return;
    }

    await actionUser(username, targetId, problematicItemsResult);
}

export async function processUserCheckQueue (event: TaskRequest<ProcessUserCheckQueueData>) {
    const jobGuid = event.data.jobGuid;
    if (jobGuid && await hasEventBeenHandled(`job:${jobGuid}`, { expiration: addMinutes(new Date(), 5) })) {
        console.warn(`User check queue job ${jobGuid} has already been handled. Skipping.`);
        return;
    }

    if (!jobGuid && await hasEventBeenHandled("job:ProcessUserCheckQueue", { expiration: addSeconds(new Date(), 30) })) {
        console.warn(`User check queue job has already been handled. Skipping.`);
        return;
    }

    const checkQueue = await redis.zRange(CHECK_QUEUE_KEY, 0, Date.now(), { by: "score" })
        .then(entries => entries.map((entry) => {
            const [username, targetId] = entry.member.split(":");
            return { username, targetId };
        }));

    const appSettings = await settings.getAll();

    if (checkQueue.length === 0) {
        if (appSettings[AppSetting.VerboseLogs]) {
            console.log("User check queue is empty.");
        }
        await cancelCheckUserJobIfQueueEmpty();
        return;
    }

    const runRecentlyKey = "UserCheckQueueRunOngoing";
    if (event.data.fromCron) {
        if (await redis.exists(runRecentlyKey)) {
            return;
        }
        if (appSettings[AppSetting.VerboseLogs]) {
            console.log(`Starting processing of user check queue with ${checkQueue.length} ${pluralize("item", checkQueue.length)}.`);
        }
    }
    await redis.set(runRecentlyKey, "true", { expiration: addSeconds(new Date(), 30) });

    const runLimit = addSeconds(new Date(), 10).getTime();

    while (checkQueue.length > 0 && Date.now() < runLimit) {
        const firstEntry = checkQueue.shift();
        if (!firstEntry) {
            break;
        }

        const { username, targetId } = firstEntry;
        await redis.zRem(CHECK_QUEUE_KEY, [`${username}:${targetId}`]);

        if (!username) {
            throw new Error(`Username is missing for targetId ${targetId}`);
        }

        if (username === "[redacted]") {
            console.log(`Skipping user check for ${username} and item ${targetId} due to username being blacklisted.`);
            continue;
        }

        try {
            await checkUserFromQueue(username, targetId as T1 | T3, appSettings);
        } catch (err) {
            if (err instanceof Error) {
                console.error(`Error processing user ${username} for item ${targetId}: ${err.message}`);
            } else {
                console.error(`Error processing user ${username} for item ${targetId}:`, err);
            }
        }
    }

    if (checkQueue.length > 0) {
        if (appSettings[AppSetting.VerboseLogs]) {
            console.log(`User check queue not fully processed, ${checkQueue.length} items remain.`);
        }
        await scheduler.runJob<ProcessUserCheckQueueData>({
            name: SchedulerJob.CheckUserQueue,
            runAt: new Date(),
            data: { jobGuid: crypto.randomUUID(), fromCron: false },
        });
    } else {
        if (appSettings[AppSetting.VerboseLogs]) {
            console.log("User check queue fully processed.");
        }
        await redis.del(runRecentlyKey);
    }
}
