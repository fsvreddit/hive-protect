import { TaskRequest, TaskResponse } from "@devvit/web/server";
import type { Context } from "hono";
import { cleanupDeletedAccounts } from "../core";

export type CleanupDeletedAccountsJobData = {
    jobGuid?: string;
    fromCron: boolean;
};

export const handleCleanupDeletedAccountsJob = async (c: Context): Promise<Response> => {
    const jobRequest = await c.req.json<TaskRequest<CleanupDeletedAccountsJobData>>();

    await cleanupDeletedAccounts(jobRequest);

    return c.json<TaskResponse>({ message: "check queue job completed" }, 200);
};
