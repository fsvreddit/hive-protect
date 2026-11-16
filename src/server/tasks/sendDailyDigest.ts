import { TaskResponse } from "@devvit/web/server";
import type { Context } from "hono";
import { hasEventBeenHandled } from "@fsvreddit/fsv-devvit-web-helpers";
import { addMinutes } from "date-fns";
import { sendDailyDigest } from "../core";

export const handleSendDailyDigestJob = async (c: Context): Promise<Response> => {
    if (await hasEventBeenHandled("job:SendDailyDigest", { expiration: addMinutes(new Date(), 1) })) {
        return c.json<TaskResponse>({ message: "send daily digest job already handled" }, 200);
    }

    await sendDailyDigest();

    return c.json<TaskResponse>({ message: "send daily digest job completed" }, 200);
};
