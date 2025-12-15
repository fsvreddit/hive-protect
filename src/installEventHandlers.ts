import { TriggerContext } from "@devvit/public-api";
import { AppInstall, AppUpgrade } from "@devvit/protos";
import { addCleanupEntriesForBannedAccounts, rescheduleCleanupEntries } from "./cleanupTasks.js";
import { AppSetting, BAN_MESSAGE_MAX_LENGTH, BAN_NOTE_MAX_LENGTH } from "./settings.js";
import json2md from "json2md";
import { createCronJobsIfNotPresent } from "./jobManagement.js";
import { subHours } from "date-fns";
import { removeQueuedEntriesOlderThan } from "./handleContentCreation.js";

export async function handleAppInstallOrUpgradeEvent (_: AppInstall | AppUpgrade, context: TriggerContext) {
    console.log("Starting app install/upgrade tasks.");

    // Clear down scheduled tasks and re-add.
    const existingJobs = await context.scheduler.listJobs();
    await Promise.all(existingJobs.map(job => context.scheduler.cancelJob(job.id)));

    await createCronJobsIfNotPresent(context);

    const cleanupPopulatedKey = "CleanupPopulated";
    const cleanupPopulated = await context.redis.get(cleanupPopulatedKey);
    if (!cleanupPopulated) {
        await addCleanupEntriesForBannedAccounts(context);
        await context.redis.set(cleanupPopulatedKey, new Date().getTime().toString());
    } else {
        await rescheduleCleanupEntries(context);
    }

    await oneOffCheckForOversizeSettings(context);

    // Remove unused Redis keys.
    await context.redis.del("subredditName");
    await context.redis.del("appName");
    await context.redis.del("secondCheckQueue");

    await removeQueuedEntriesOlderThan(subHours(new Date(), 2), context);

    console.log("Completed app install/upgrade tasks.");
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
        const subredditName = context.subredditName ?? (await context.reddit.getCurrentSubreddit()).name;

        const modmail: json2md.DataObject[] = [
            { p: `Thanks for upgrading Hive Protector on /r/${subredditName}.` },
            { p: `There's an issue with  the [settings](https://developers.reddit.com/r/${subredditName}/apps/hive-protect) that needs to be addressed for this app to work properly.` },
        ];

        const bullets: string[] = [];
        if (banMessageTooLong) {
            bullets.push(`The Ban Message is too long - it needs to be under ${BAN_MESSAGE_MAX_LENGTH} characters long.`);
        }
        if (banNoteTooLong) {
            bullets.push(`The Ban Note is too long - it needs to be under ${BAN_NOTE_MAX_LENGTH} characters long.`);
        }

        modmail.push({ ul: bullets });

        modmail.push({ p: "It is likely that Hive Protector will not be able to ban users until this is resolved. Sorry for the inconvenience." });

        await context.reddit.sendPrivateMessage({
            subject: "Hive Protector Configuration Issue",
            to: `/r/${subredditName}`,
            text: json2md(modmail),
        });
    }

    await context.redis.set(redisKey, "true");
}
