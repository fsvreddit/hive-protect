import { TriggerContext } from "@devvit/public-api";
import { CommentSubmit, PostSubmit } from "@devvit/protos";
import { isCommentId, isLinkId } from "@devvit/public-api/types/tid.js";
import { addDays, addHours } from "date-fns";
import { getPostOrCommentById } from "./utility.js";
import { AppSetting, ContentTypeToActOn } from "./settings.js";
import { actionUser } from "./actionUser.js";
import { problematicItemsFound } from "./getProblematicItems.js";

export const APPROVALS_KEY = "ItemApprovalCount";

export async function handlePostSubmitEvent (event: PostSubmit, context: TriggerContext) {
    if (!event.author?.name || !event.post || !event.subreddit) {
        console.log("Event is not in the right state.");
        return;
    }

    await handlePostOrCommentSubmitEvent(event.post.id, event.subreddit.name, event.author.name, context);
}

export async function handleCommentSubmitEvent (event: CommentSubmit, context: TriggerContext) {
    if (!event.author?.name || !event.comment || !event.subreddit) {
        console.log("Event is not in the right state.");
        return;
    }

    await handlePostOrCommentSubmitEvent(event.comment.id, event.subreddit.name, event.author.name, context);
}

export async function handlePostOrCommentSubmitEvent (targetId: string, subredditName: string, userName: string, context: TriggerContext) {
    if (userName === "AutoModerator" || userName === `${subredditName}-ModTeam` || userName === context.appName) {
        // Automod could legitimately have activity in "bad" subreddits, but we never want to act on it.
        return false;
    }

    const kind = isLinkId(targetId) ? "link" : "comment";
    const problematicItemsResult = await problematicItemsFound(context, subredditName, userName, kind);

    if (problematicItemsResult.badSubs.length === 0 && problematicItemsResult.badDomains.length === 0) {
        if (problematicItemsResult.userBlocking) {
            const redisKey = `userBlocking~${userName}`;
            const hasBeenReported = await context.redis.get(redisKey);
            if (!hasBeenReported) {
                const target = await getPostOrCommentById(targetId, context);
                await context.reddit.report(target, { reason: "User may be blocking bot. Check history for subs not modded by Hive Protector." });
            }
            await context.redis.set(redisKey, "true", { expiration: addDays(new Date(), 7) });
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

    const settings = await context.settings.getAll();

    // Now check if the submission is of a type configured to be checked.
    // I'm doing this second because it's likely that most subreddits will be configured as "Posts And Comments",
    // So for most cases, we might be able to reduce load by ruling out based on recently cached negative checks first.
    const typesToActOn = (settings[AppSetting.ContentTypeToActOn] as string[] | undefined ?? [ContentTypeToActOn.PostsAndComments])[0] as ContentTypeToActOn;
    if ((typesToActOn === ContentTypeToActOn.PostsOnly && isCommentId(targetId)) || (typesToActOn === ContentTypeToActOn.CommentsOnly && isLinkId(targetId))) {
        // Invalid type of item to check.
        return;
    }

    await actionUser(userName, targetId, problematicItemsResult, context);
}
