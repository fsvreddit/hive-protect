import { context, redis } from "@devvit/web/server";
import { UiResponse } from "@devvit/web/shared";
import { Context } from "hono";
import { getPostOrCommentById } from "@fsvreddit/fsv-devvit-web-helpers";
import { getUserExemptionKey, setCleanupForUser, userIsExemptByMenu } from "../core";

export const handleToggleExemptionStatusMenu = async (c: Context): Promise<Response> => {
    const targetId = context.commentId ?? context.postId;
    if (!targetId) {
        return c.json<UiResponse>({
            showToast: "Error: Cannot determine who to exempt.",
        });
    }

    const target = await getPostOrCommentById(targetId);

    const username = target.authorName;
    const isExempt = await userIsExemptByMenu(username);

    if (isExempt) {
        await redis.del(getUserExemptionKey(username));
        console.log(`Removed user ${username} from exempt list.`);
        return c.json<UiResponse>({
            showToast: `Removed user ${username} from exempt list.`,
        });
    } else {
        await redis.set(getUserExemptionKey(username), "true");
        await setCleanupForUser(username);
        console.log(`Added user ${username} to exempt list.`);
        return c.json<UiResponse>({
            showToast: `Added user ${username} to exempt list.`,
        });
    }
};
