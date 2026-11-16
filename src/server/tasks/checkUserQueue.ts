import { TaskRequest, TaskResponse } from "@devvit/web/server";
import type { Context } from "hono";
import { processUserCheckQueue } from "../core";

export type ProcessUserCheckQueueData = {
    jobGuid?: string;
    fromCron: boolean;
};

export const handleCheckUserQueueJob = async (c: Context): Promise<Response> => {
    const jobRequest = await c.req.json<TaskRequest<ProcessUserCheckQueueData>>();

    await processUserCheckQueue(jobRequest);

    return c.json<TaskResponse>({ message: "check queue job completed" }, 200);
};
