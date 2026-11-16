import { OnCommentCreateRequest, T1, TriggerResponse } from "@devvit/web/shared";
import { Context } from "hono";
import { fixCommentTriggerEvent } from "@fsvreddit/fsv-devvit-web-helpers";
import { handlePostOrCommentSubmitEvent } from "../core";

export const onCommentCreate = async (c: Context): Promise<Response> => {
    const event = await fixCommentTriggerEvent(await c.req.json<OnCommentCreateRequest>());

    if (!event.comment?.id || !event.author?.name) {
        console.log("Event is not in the right state.");
        return c.json<TriggerResponse>({ message: "Invalid event" }, 200);
    }

    await handlePostOrCommentSubmitEvent(event.comment.id as T1, event.author.name);

    return c.json<TriggerResponse>({ message: "Event handled" }, 200);
};
