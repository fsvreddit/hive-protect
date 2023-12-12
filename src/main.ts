import {Devvit} from "@devvit/public-api";
import {handlePostOrCommentSubmitEvent} from "./hiveProtect.js";

Devvit.addSettings([
    {
        type: "paragraph",
        name: "subreddits",
        label: "Enter a comma-separated list of subreddits to watch e.g. freekarma4u,freekarma4all",
    },
    {
        type: "number",
        name: "itemcount",
        label: "Number of posts and comments to meet threshold",
        helpText: "User must have at least this many posts or comments in 'bad' subreddits to result in a removal/ban",
        defaultValue: 6,
        onValidate: ({value}) => {
            if (!value || value < 1) {
                return "Threshold must be at least 1";
            }
        },
    },
    {
        type: "number",
        name: "daystomonitor",
        label: "Number of days to monitor",
        helpText: "Only comments within this number of days will be counted",
        defaultValue: 28,
        onValidate: ({value}) => {
            if (!value || value < 1) {
                return "Days to monitor must be at least 1";
            }
        },
    },
    {
        type: "paragraph",
        name: "banmessage",
        label: "Enter a ban message to send to users",
        helpText: "Placeholder found: {{sublist}}. This will be replaced with a comma-separated list of the matched subs",
    },
    {
        type: "string",
        name: "bannote",
        label: "Enter a note to put in the ban log (optional)",
        helpText: "Placeholder found: {{sublist}}. This will be replaced with a comma-separated list of the matched subs",
    },
    {
        type: "boolean",
        name: "exemptapproveduser",
        label: "Exempt approved users",
        helpText: "If this option is selected, approved users will not be checked.",
    },
]);

Devvit.addTrigger({
    events: ["PostSubmit", "CommentSubmit"],
    onEvent: handlePostOrCommentSubmitEvent,
});

Devvit.addSchedulerJob({
    name: "redisMigration",
    onRun: async (_, context) => {
        console.log("kvStore to Redis migration in progress");

        const keys = await context.kvStore.list();
        const lastCheckKeys = keys.filter(key => key.startsWith("participation-lastcheck"));

        if (lastCheckKeys.length === 0) {
            console.log("Redis migration complete. Removing scheduled jobs.");
            const currentJobs = await context.scheduler.listJobs();
            await Promise.all(currentJobs.map(job => context.scheduler.cancelJob(job.id)));
            await context.redis.set("redis-migration-complete", "true");
        }

        // Delete a batch of "Last Check" keys.
        const keysToRemove = lastCheckKeys.slice(0, 200);
        await Promise.all(keysToRemove.map(key => context.kvStore.delete(key)));
        console.log(`Removed ${keysToRemove.length} keys from kvStore. ${lastCheckKeys.length - keysToRemove.length} keys still to remove.`);
    },
});

Devvit.addTrigger({
    event: "AppUpgrade",
    async onEvent (_, context) {
        const currentJobs = await context.scheduler.listJobs();
        await Promise.all(currentJobs.map(job => context.scheduler.cancelJob(job.id)));

        const redisMigrationComplete = await context.redis.get("redis-migration-complete");
        if (redisMigrationComplete !== undefined) {
            // Schedule job to remove legacy "last checked" keys
            await context.scheduler.runJob({
                cron: "* * * * *", // Every minute while job exists
                name: "redisMigration",
            });
        }
    },
});

Devvit.configure({
    redditAPI: true,
    kvStore: true,
    redis: true,
});

export default Devvit;
