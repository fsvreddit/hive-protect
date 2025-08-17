import { Comment, Context, MenuItemOnPressEvent, Post, TriggerContext } from "@devvit/public-api";
import { isLinkId } from "@devvit/shared-types/tid.js";
import { setCleanupForUser } from "./cleanupTasks.js";

export async function userIsExemptByMenu (username: string, context: Context | TriggerContext): Promise<boolean> {
    const existsVal = await context.redis.exists(`userExempt:${username}`);
    return existsVal === 1;
}

export async function handleUserExemptMenu (_: MenuItemOnPressEvent, context: Context) {
    const targetId = context.commentId ?? context.postId;
    if (!targetId) {
        context.ui.showToast("Error: Cannot determine who to exempt.");
        return;
    }

    let target: Post | Comment;
    if (isLinkId(targetId)) {
        target = await context.reddit.getPostById(targetId);
    } else {
        target = await context.reddit.getCommentById(targetId);
    }

    const username = target.authorName;
    const isExempt = await userIsExemptByMenu(username, context);

    if (isExempt) {
        await context.redis.del(`userExempt:${username}`);
        context.ui.showToast(`Removed user ${username} from exempt list.`);
        console.log(`Removed user ${username} from exempt list.`);
    } else {
        await context.redis.set(`userExempt:${username}`, "true");
        await setCleanupForUser(username, context);
        context.ui.showToast(`Added user ${username} to exempt list.`);
        console.log(`Added user ${username} to exempt list.`);
    }
}
