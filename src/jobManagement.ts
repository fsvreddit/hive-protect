import { ScheduledCronJob, ScheduledJob, TriggerContext } from "@devvit/public-api";
import { SchedulerJob } from "./constants.js";
import pluralize from "pluralize";

export async function createCronJobsIfNotPresent (context: TriggerContext) {
    const jobs = await context.scheduler.listJobs();

    const jobsToRemove: (ScheduledJob | ScheduledCronJob)[] = [];

    const cleanupJobs = jobs.filter(job => job.name === SchedulerJob.CleanupDeletedAccounts as string);
    if (cleanupJobs.length === 0) {
        // Cleanup job should run every hour. Randomise start time.
        const minute = Math.floor(Math.random() * 60);
        const hour = Math.floor(Math.random() * 6);

        await context.scheduler.runJob({
            name: SchedulerJob.CleanupDeletedAccounts,
            cron: `${minute} ${hour}/6 * * *`,
            data: { fromCron: true },
        });

        console.log(`Running cleanup job at ${minute} past every 6th hour starting at ${hour}.`);
    }

    const processQueueJobs = jobs.filter(job => job.name === SchedulerJob.CheckUserQueue as string);
    if (processQueueJobs.length === 0) {
        await context.scheduler.runJob({
            name: SchedulerJob.CheckUserQueue,
            cron: "* * * * *",
            data: { fromCron: true },
        });

        console.log("Scheduled user check queue processing job to run every minute.");
    }

    if (cleanupJobs.length > 1) {
        jobsToRemove.push(...cleanupJobs.slice(1));
    }

    if (processQueueJobs.length > 1) {
        jobsToRemove.push(...processQueueJobs.slice(1));
    }

    if (jobsToRemove.length > 0) {
        await Promise.all(jobsToRemove.map(job => context.scheduler.cancelJob(job.id)));
        console.log(`Removed ${jobsToRemove.length} duplicate scheduled ${pluralize("job", jobsToRemove.length)}.`);
    }
}
