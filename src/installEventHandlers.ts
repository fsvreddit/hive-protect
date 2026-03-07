import { TriggerContext } from "@devvit/public-api";
import { AppInstall, AppUpgrade } from "@devvit/protos";
import { createCronJobsIfNotPresent } from "./jobManagement.js";
import { addSeconds, subHours } from "date-fns";
import { removeQueuedEntriesOlderThan } from "./handleContentCreation.js";
import { SchedulerJob, V2_UPDATE_NOTIFICATION_SENT_KEY } from "./constants.js";

async function handleCommonInstallTasks (context: TriggerContext) {
    console.log("Starting app install/upgrade tasks.");

    // Clear down scheduled tasks and re-add.
    const existingJobs = await context.scheduler.listJobs();
    await Promise.all(existingJobs.map(job => context.scheduler.cancelJob(job.id)));

    await createCronJobsIfNotPresent(context);

    // Remove unused Redis keys.
    await context.redis.del("subredditName");
    await context.redis.del("appName");
    await context.redis.del("secondCheckQueue");
    await context.redis.del("CleanupPopulated");

    await context.scheduler.runJob({
        name: SchedulerJob.DailyDigest,
        runAt: new Date(),
    });

    await removeQueuedEntriesOlderThan(subHours(new Date(), 2), context);

    console.log("Completed app install/upgrade tasks.");
}

export async function handleAppInstallEvent (_: AppInstall, context: TriggerContext) {
    await context.redis.set(V2_UPDATE_NOTIFICATION_SENT_KEY, context.appVersion);
    await handleCommonInstallTasks(context);
}

export async function handleAppUpgradeEvent (_: AppUpgrade, context: TriggerContext) {
    await handleCommonInstallTasks(context);

    if (!await context.redis.exists(V2_UPDATE_NOTIFICATION_SENT_KEY)) {
        // Run update notifier job at a random time in the next half hour.
        const randomSeconds = 10 + Math.floor(Math.random() * 1800);
        const runTime = addSeconds(new Date(), randomSeconds);
        await context.scheduler.runJob({
            name: SchedulerJob.V2UpdateNotifier,
            runAt: runTime,
        });

        console.log(`Scheduled V2 update notifier to run at ${runTime.toISOString()}.`);
    }
}
