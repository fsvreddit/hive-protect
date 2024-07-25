import {TriggerContext} from "@devvit/public-api";
import {AppInstall, AppUpgrade} from "@devvit/protos";
import {addCleanupEntriesForBannedAccounts} from "./cleanupTasks.js";

export async function handleAppInstallOrUpgradeEvent (_: AppInstall | AppUpgrade, context: TriggerContext) {
    // Clean up old redis key, no longer used.
    await context.redis.del("subredditName");

    // Clear down scheduled tasks and re-add.
    const existingJobs = await context.scheduler.listJobs();
    await Promise.all(existingJobs.map(job => context.scheduler.cancelJob(job.id)));

    // Cleanup job should run every 30 minutes. Randomise start time.
    const minute = Math.floor(Math.random() * 30);
    console.log(`Running cleanup job at ${minute} and ${minute + 30} past the hour.`);

    await context.scheduler.runJob({
        name: "cleanupDeletedAccounts",
        cron: `${minute}/30 * * * *`,
    });

    const cleanupPopulated = await context.redis.get("CleanupPopulated");
    if (!cleanupPopulated) {
        await addCleanupEntriesForBannedAccounts(context);
        await context.redis.set("CleanupPopulated", new Date().getTime().toString());
    }
}
