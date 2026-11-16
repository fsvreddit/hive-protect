import { redis } from "@devvit/web/server";
import { OnModActionRequest, TriggerResponse } from "@devvit/web/shared";
import { Context } from "hono";
import { hasEventBeenHandled } from "@fsvreddit/fsv-devvit-web-helpers";
import { addMinutes } from "date-fns";
import { APPROVALS_KEY, setCleanupForUser } from "../core";

export const onModAction = async (c: Context): Promise<Response> => {
    const event = await c.req.json<OnModActionRequest>();

    if (await hasEventBeenHandled(`ModAction:${event.action}:${event.moderator?.name}:${event.actionedAt}`, { expiration: addMinutes(new Date(), 10) })) {
        return c.json<TriggerResponse>({ message: "Trigger has already been handled." }, 200);
    }

    if (event.targetUser && (event.action === "approvecomment" || event.action === "approvelink")) {
        let targetId: string | undefined;
        if (event.action === "approvecomment") {
            targetId = event.targetComment?.id;
        } else {
            targetId = event.targetPost?.id;
        }

        if (!targetId) {
            // This should be impossible, but handle anyway.
            console.error("No targetId found for approve event. This should not happen.");
            return c.json<TriggerResponse>({ message: "No targetId found for approve event." }, 200);
        }

        // Check to see if post/comment was previously flagged by this app.
        const itemReported = await redis.exists(`itemreported~${targetId}`);
        if (!itemReported) {
            return c.json<TriggerResponse>({ message: "Item was not reported." }, 200);
        }

        // Increment approvals counter.
        const newApprovalCount = await redis.zIncrBy(APPROVALS_KEY, event.targetUser.name, 1);
        await setCleanupForUser(event.targetUser.name);
        console.log(`Approved a reported comment by ${event.targetUser.name}. Approval counter is now ${newApprovalCount}.`);
    }

    return c.json<TriggerResponse>({ message: "Mod action handled." }, 200);
};
