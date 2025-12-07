import { JobContext, JSONObject, ScheduledJobEvent, SettingsValues, TriggerContext } from "@devvit/public-api";
import { CommentSubmit, PostSubmit } from "@devvit/protos";
import { isCommentId, isLinkId } from "@devvit/public-api/types/tid.js";
import { addDays, addHours, addSeconds } from "date-fns";
import { getPostOrCommentById } from "./utility.js";
import { AppSetting, ContentTypeToActOn } from "./settings.js";
import { actionUser } from "./actionUser.js";
import { problematicItemsFound } from "./getProblematicItems.js";
import { SchedulerJob } from "./constants.js";
import { setCleanupForUser } from "./cleanupTasks.js";

export const APPROVALS_KEY = "ItemApprovalCount";

export async function handlePostSubmitEvent (event: PostSubmit, context: TriggerContext) {
    if (!event.author?.name || !event.post) {
        console.log("Event is not in the right state.");
        return;
    }

    await handlePostOrCommentSubmitEvent(event.post.id, event.author.name, context);
}

export async function handleCommentSubmitEvent (event: CommentSubmit, context: TriggerContext) {
    if (!event.author?.name || !event.comment) {
        console.log("Event is not in the right state.");
        return;
    }

    await handlePostOrCommentSubmitEvent(event.comment.id, event.author.name, context);
}

const CHECK_QUEUE_KEY = "UserCheckQueue";

async function addUserToQueue (targetId: string, username: string, context: TriggerContext) {
    await context.redis.zAdd(CHECK_QUEUE_KEY, { member: `${username}:${targetId}`, score: addSeconds(new Date(), 10).getTime() });
}

export async function handlePostOrCommentSubmitEvent (targetId: string, userName: string, context: TriggerContext) {
    if (userName === "AutoModerator" || userName === `${context.subredditName}-ModTeam` || userName === context.appName) {
        // Automod could legitimately have activity in "bad" subreddits, but we never want to act on it.
        return false;
    }

    await addUserToQueue(targetId, userName, context);
}

export async function checkUserFromQueue (username: string, targetId: string, settings: SettingsValues, context: TriggerContext) {
    const subredditName = context.subredditName ?? await context.reddit.getCurrentSubredditName();

    const kind = isLinkId(targetId) ? "link" : "comment";
    const problematicItemsResult = await problematicItemsFound(context, subredditName, username, kind, settings);

    if (problematicItemsResult.badSubs.length === 0 && problematicItemsResult.badDomains.length === 0) {
        if (problematicItemsResult.userBlocking) {
            const redisKey = `userBlocking~${username}`;
            const hasBeenReported = await context.redis.get(redisKey);
            if (!hasBeenReported) {
                const target = await getPostOrCommentById(targetId, context);
                await context.reddit.report(target, { reason: "User may be blocking bot. Check history for subs not modded by Hive Protector." });
            }
            await context.redis.set(redisKey, "true", { expiration: addDays(new Date(), 7) });

            if (settings[AppSetting.AntiBlockCheckerAddModNote]) {
                const modNoteKey = `antiBlockModNoteAdded~${username}`;
                if (!await context.redis.exists(modNoteKey)) {
                    await context.reddit.addModNote({
                        subreddit: subredditName,
                        user: username,
                        note: "User may be blocking Hive Protector",
                        label: "SPAM_WARNING",
                    });
                    await context.redis.set(modNoteKey, "true");
                    await setCleanupForUser(username, context);
                }
            }
        }
        return;
    }

    const redisKey = `alreadyChecked~${targetId}`;
    const alreadyChecked = await context.redis.get(redisKey);
    if (alreadyChecked) {
        console.log(`Duplicate event fired for ${targetId}`);
        return;
    }
    await context.redis.set(redisKey, "true", { expiration: addHours(new Date(), 6) });

    // Now check if the submission is of a type configured to be checked.
    // I'm doing this second because it's likely that most subreddits will be configured as "Posts And Comments",
    // So for most cases, we might be able to reduce load by ruling out based on recently cached negative checks first.
    const typesToActOn = (settings[AppSetting.ContentTypeToActOn] as string[] | undefined ?? [ContentTypeToActOn.PostsAndComments])[0] as ContentTypeToActOn;
    if ((typesToActOn === ContentTypeToActOn.PostsOnly && isCommentId(targetId)) || (typesToActOn === ContentTypeToActOn.CommentsOnly && isLinkId(targetId))) {
        // Invalid type of item to check.
        return;
    }

    await actionUser(username, targetId, problematicItemsResult, context);
}

export async function processUserCheckQueue (event: ScheduledJobEvent<JSONObject | undefined>, context: JobContext) {
    const checkQueue = await context.redis.zRange(CHECK_QUEUE_KEY, 0, Date.now(), { by: "score" })
        .then(entries => entries.map((entry) => {
            const [username, targetId] = entry.member.split(":");
            return { username, targetId };
        }));

    if (checkQueue.length === 0) {
        return;
    }

    const runRecentlyKey = "UserCheckQueueRunRecently";
    if (event.data?.fromCron && await context.redis.exists(runRecentlyKey)) {
        return;
    }
    await context.redis.set(runRecentlyKey, "true", { expiration: addSeconds(new Date(), 30) });

    const runLimit = addSeconds(new Date(), 10).getTime();
    const settings = await context.settings.getAll();

    while (checkQueue.length > 0 && Date.now() < runLimit) {
        const firstEntry = checkQueue.shift();
        if (!firstEntry) {
            break;
        }

        const { username, targetId } = firstEntry;
        await checkUserFromQueue(username, targetId, settings, context);
        await context.redis.zRem(CHECK_QUEUE_KEY, [`${username}:${targetId}`]);
    }

    if (checkQueue.length > 0) {
        console.log(`User check queue not fully processed, ${checkQueue.length} items remain.`);
        await context.scheduler.runJob({
            name: SchedulerJob.CheckUserQueue,
            runAt: new Date(),
        });
    } else {
        await context.redis.del(runRecentlyKey);
    }
}
