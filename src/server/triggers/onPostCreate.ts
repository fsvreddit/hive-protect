import { OnPostCreateRequest, T3, TriggerResponse } from "@devvit/web/shared";
import { Context } from "hono";
import { fixPostTriggerEvent } from "@fsvreddit/fsv-devvit-web-helpers";
import { handlePostOrCommentSubmitEvent } from "../core";

export const onPostCreate = async (c: Context): Promise<Response> => {
    const event = await fixPostTriggerEvent(await c.req.json<OnPostCreateRequest>());

    if (!event.post?.id || !event.author?.name) {
        console.log("Event is not in the right state.");
        return c.json<TriggerResponse>({ message: "Invalid event" }, 200);
    }

    await handlePostOrCommentSubmitEvent(event.post.id as T3, event.author.name);

    return c.json<TriggerResponse>({ message: "Event handled" }, 200);
};
