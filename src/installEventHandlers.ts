import {TriggerContext} from "@devvit/public-api";
import {AppInstall, AppUpgrade} from "@devvit/protos";
import {addCleanupEntriesForBannedAccounts, rescheduleCleanupEntries} from "./cleanupTasks.js";
import {AppSetting, BAN_MESSAGE_MAX_LENGTH, BAN_NOTE_MAX_LENGTH} from "./settings.js";

export async function handleAppInstallOrUpgradeEvent (_: AppInstall | AppUpgrade, context: TriggerContext) {
    // Clean up old redis key, no longer used.
    await context.redis.del("subredditName");

    // Clear down scheduled tasks and re-add.
    const existingJobs = await context.scheduler.listJobs();
    await Promise.all(existingJobs.map(job => context.scheduler.cancelJob(job.id)));

    // Cleanup job should run every hour. Randomise start time.
    const minute = Math.floor(Math.random() * 60);
    const hour = Math.floor(Math.random() * 6);
    console.log(`Running cleanup job at ${minute} past every 6th hour starting at ${hour}.`);

    await context.scheduler.runJob({
        name: "cleanupDeletedAccounts",
        cron: `${minute} ${hour}/6 * * *`,
    });

    const cleanupPopulated = await context.redis.get("CleanupPopulated");
    if (!cleanupPopulated) {
        await addCleanupEntriesForBannedAccounts(context);
        await context.redis.set("CleanupPopulated", new Date().getTime().toString());
    } else {
        await rescheduleCleanupEntries(context);
    }

    await oneOffCheckForOversizeSettings(context);
}

async function oneOffCheckForOversizeSettings (context: TriggerContext) {
    const redisKey = "OneOffSizeCheck";
    const alreadyDone = await context.redis.get(redisKey);
    if (alreadyDone) {
        return;
    }

    const settings = await context.settings.getAll();
    const banUser = settings[AppSetting.BanEnabled] as boolean | undefined;
    const banMessage = settings[AppSetting.BanMessage] as string | undefined;
    const banNote = settings[AppSetting.BanNote] as string | undefined;

    const banMessageTooLong = banMessage && banMessage.length > BAN_MESSAGE_MAX_LENGTH;
    const banNoteTooLong = banNote && banNote.length > BAN_NOTE_MAX_LENGTH;

    if (banUser && (banMessageTooLong || banNoteTooLong)) {
        const subreddit = await context.reddit.getCurrentSubreddit();
        const appUser = await context.reddit.getAppUser();

        let modmail = `Thanks for upgrading Hive Protector on /r/${subreddit.name}.\n\n`;
        modmail += `There's an issue with  the [settings](https://developers.reddit.com/r/${subreddit.name}/apps/hive-protect) that needs to be addressed for this app to work properly.\n\n`;
        if (banMessageTooLong) {
            modmail += `* The Ban Message is too long - it needs to be under ${BAN_MESSAGE_MAX_LENGTH} characters long.\n`;
        }
        if (banNoteTooLong) {
            modmail += `* The Ban Note is too long - it needs to be under ${BAN_NOTE_MAX_LENGTH} characters long.\n`;
        }

        modmail += "\nIt is likely that Hive Protector will not be able to ban users until this is resolved. Sorry for the inconvenience.";

        await context.reddit.modMail.createConversation({
            subject: "Hive Protector Configuration Issue",
            subredditName: subreddit.name,
            to: appUser.username,
            body: modmail,
        });
    }

    await context.redis.set(redisKey, "true");
}
