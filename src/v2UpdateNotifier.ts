import { JobContext, JSONObject, ScheduledJobEvent } from "@devvit/public-api";
import { V2_UPDATE_NOTIFICATION_SENT_KEY } from "./constants.js";
import { hasTriggerBeenHandled } from "@fsvreddit/fsv-devvit-helpers";
import { addMinutes } from "date-fns";

export async function handleV2UpdateNotifierJob (event: ScheduledJobEvent<JSONObject | undefined>, context: JobContext) {
    const jobGuid = event.data?.jobGuid as string | undefined;
    if (jobGuid && await hasTriggerBeenHandled(context.redis, `job:${jobGuid}`, { expiration: addMinutes(new Date(), 5) })) {
        console.warn(`V2 update notifier job ${jobGuid} has already been handled. Skipping.`);
        return;
    }

    if (await context.redis.exists(V2_UPDATE_NOTIFICATION_SENT_KEY)) {
        console.log("V2 update notification has already been sent, skipping.");
        return;
    }

    const wikiPage = await context.reddit.getWikiPage("fsvapps", "hive-protector-v2");
    const message = wikiPage.content
        .replaceAll("{{version}}", context.appVersion)
        .replaceAll("{{subreddit}}", context.subredditName ?? await context.reddit.getCurrentSubredditName());

    if (message.trim().length === 0) {
        console.log("V2 update notification wiki page is empty, skipping.");
        return;
    }

    await context.reddit.modMail.createModNotification({
        subredditId: context.subredditId,
        subject: "Hive Protector has been updated: Important information",
        bodyMarkdown: message,
    });

    await context.redis.set(V2_UPDATE_NOTIFICATION_SENT_KEY, context.appVersion);
    console.log("V2 update notification sent.");
}
