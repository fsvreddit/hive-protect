import { redis, scheduler } from "@devvit/web/server";
import { TriggerResponse } from "@devvit/web/shared";
import { Context } from "hono";
import { createCronJobsIfNotPresent, removeQueuedEntriesOlderThan } from "../core";
import { subHours } from "date-fns";

export const onAppInstallOrUpgrade = async (c: Context): Promise<Response> => {
    console.log("Starting app install/upgrade tasks.");

    // Clear down scheduled tasks and re-add.
    const existingJobs = await scheduler.listJobs();
    await Promise.all(existingJobs.map(job => scheduler.cancelJob(job.id)));

    await createCronJobsIfNotPresent();

    // Remove unused Redis keys.
    await redis.del("subredditName", "appName", "secondCheckQueue", "CleanupPopulated");

    await removeQueuedEntriesOlderThan(subHours(new Date(), 2));

    console.log("Completed app install/upgrade tasks.");

    return c.json<TriggerResponse>({ message: "App install or upgrade handled." }, 200);
};
