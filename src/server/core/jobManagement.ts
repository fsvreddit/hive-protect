import { redis, ScheduledCronJob, ScheduledJob, scheduler } from "@devvit/web/server";
import { CHECK_QUEUE_KEY, SchedulerJob } from ".";
import pluralize from "pluralize";
import { CleanupDeletedAccountsJobData, ProcessUserCheckQueueData } from "../tasks";
import { hasEventBeenHandled } from "@fsvreddit/fsv-devvit-web-helpers";
import { addMinutes, addSeconds } from "date-fns";

export async function createCronJobsIfNotPresent () {
    const jobs = await scheduler.listJobs();

    const jobsToRemove: (ScheduledJob | ScheduledCronJob)[] = [];

    const cleanupJobs = jobs.filter(job => job.name === SchedulerJob.CleanupDeletedAccounts as string);
    if (cleanupJobs.length === 0) {
        // Cleanup job should run every hour. Randomise start time.
        const minute = Math.floor(Math.random() * 60);
        const hour = Math.floor(Math.random() * 6);

        await scheduler.runJob<CleanupDeletedAccountsJobData>({
            name: SchedulerJob.CleanupDeletedAccounts,
            cron: `${minute} ${hour}/6 * * *`,
            data: { fromCron: true },
        });

        console.log(`Running cleanup job at ${minute} past every 6th hour starting at ${hour}.`);
    }

    await createCheckUserJobIfNotPresent(jobs);

    const dailyDigestJobs = jobs.filter(job => job.name === SchedulerJob.DailyDigest as string);
    if (dailyDigestJobs.length === 0) {
        const randomMinute = Math.floor(Math.random() * 60);
        await scheduler.runJob({
            name: SchedulerJob.DailyDigest,
            cron: `${randomMinute} 0 * * *`,
        });
    }

    if (cleanupJobs.length > 1) {
        jobsToRemove.push(...cleanupJobs.slice(1));
    }

    if (dailyDigestJobs.length > 1) {
        jobsToRemove.push(...dailyDigestJobs.slice(1));
    }

    if (jobsToRemove.length > 0) {
        await Promise.all(jobsToRemove.map(job => scheduler.cancelJob(job.id)));
        console.log(`Removed ${jobsToRemove.length} duplicate scheduled ${pluralize("job", jobsToRemove.length)}.`);
    }
}

const JOB_EXISTS_KEY = "checkUserJobExists";

export async function createCheckUserJobIfNotPresent (jobs?: (ScheduledJob | ScheduledCronJob)[]) {
    if (await redis.exists(JOB_EXISTS_KEY)) {
        return;
    }

    if (await hasEventBeenHandled("CreateUserCheckJob", { expiration: addSeconds(new Date(), 5) })) {
        return;
    }

    let processQueueJobs: (ScheduledJob | ScheduledCronJob)[];
    if (jobs) {
        processQueueJobs = [...jobs.filter(job => job.name === SchedulerJob.CheckUserQueue as string)];
    } else {
        processQueueJobs = await scheduler.listJobs().then(jobs => jobs.filter(job => job.name === SchedulerJob.CheckUserQueue as string));
    }

    if (processQueueJobs.length === 1) {
        await redis.set(JOB_EXISTS_KEY, Date.now().toString(), { expiration: addMinutes(new Date(), 30) });
        return;
    }

    if (processQueueJobs.length > 1) {
        await Promise.all(processQueueJobs.slice(1).map(job => scheduler.cancelJob(job.id)));
        console.log(`Removed ${processQueueJobs.length - 1} duplicate scheduled ${pluralize("job", processQueueJobs.length - 1)}.`);
        return;
    }

    await scheduler.runJob<ProcessUserCheckQueueData>({
        name: SchedulerJob.CheckUserQueue,
        cron: "* * * * *",
        data: { fromCron: true },
    });

    await redis.set(JOB_EXISTS_KEY, Date.now().toString(), { expiration: addMinutes(new Date(), 30) });
}

export async function cancelCheckUserJobIfQueueEmpty () {
    const entriesInQueue = await redis.zCard(CHECK_QUEUE_KEY);
    if (entriesInQueue > 0) {
        return;
    }

    const processQueueJobs = await scheduler.listJobs().then(jobs => jobs.filter(job => job.name === SchedulerJob.CheckUserQueue as string));
    if (processQueueJobs.length === 0) {
        return;
    }

    await Promise.all(processQueueJobs.map(job => scheduler.cancelJob(job.id)));
    console.log(`Cancelled ${processQueueJobs.length} scheduled ${pluralize("job", processQueueJobs.length)} for checking user queue.`);

    await redis.del(JOB_EXISTS_KEY);
}
