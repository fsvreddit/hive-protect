import { ScheduledCronJob, ScheduledJob, TriggerContext } from "@devvit/public-api";
import { SchedulerJob } from "./constants.js";

export async function createCronJobsIfNotPresent (context: TriggerContext) {
    const jobs = await context.scheduler.listJobs();

    const jobsToRemove: (ScheduledJob | ScheduledCronJob)[] = [];

    const cleanupJobs = jobs.filter(job => job.name === SchedulerJob.CleanupDeletedAccounts as string);
    if (cleanupJobs.length === 0) {
        // Cleanup job should run every hour. Randomise start time.
        const minute = Math.floor(Math.random() * 60);
        const hour = Math.floor(Math.random() * 6);
        console.log(`Running cleanup job at ${minute} past every 6th hour starting at ${hour}.`);

        await context.scheduler.runJob({
            name: SchedulerJob.CleanupDeletedAccounts,
            cron: `${minute} ${hour}/6 * * *`,
            data: { fromCron: true },
        });
    }

    const processQueueJobs = jobs.filter(job => job.name === SchedulerJob.CheckUserQueue as string);
    if (processQueueJobs.length === 0) {
        await context.scheduler.runJob({
            name: SchedulerJob.CheckUserQueue,
            cron: "* * * * *",
            data: { fromCron: true },
        });
    }

    if (cleanupJobs.length > 1) {
        jobsToRemove.push(...cleanupJobs.slice(1));
    }

    if (processQueueJobs.length > 1) {
        jobsToRemove.push(...processQueueJobs.slice(1));
    }

    await Promise.all(jobsToRemove.map(job => context.scheduler.cancelJob(job.id)));
}
