import { context, reddit, redis, settings } from "@devvit/web/server";
import { isT3 } from "@devvit/web/shared";
import { AppSetting, ProblematicSubsResult } from ".";
import json2md from "json2md";

const DAILY_DIGEST_QUEUE_KEY = "dailyDigestQueue";

type ProblematicSubsResultWithItem = ProblematicSubsResult & { targetId: string; sourceUrl: string };

export async function queueUserForDigest (username: string, targetId: string, sourceUrl: string, problematicItemsResult: ProblematicSubsResult) {
    const recordToStore = {
        ...problematicItemsResult,
        targetId,
        sourceUrl,
    };

    await redis.hSet(DAILY_DIGEST_QUEUE_KEY, { [username]: JSON.stringify(recordToStore) });
}

function getPostOrCommentLink (targetId: string, targetUrl: string): string {
    const kind = isT3(targetId) ? "Post" : "Comment";

    return `[${kind}](${targetUrl})`;
}

export async function sendDailyDigest () {
    const queue = await redis.hGetAll(DAILY_DIGEST_QUEUE_KEY);
    await redis.del(DAILY_DIGEST_QUEUE_KEY);

    if (!await settings.get<boolean>(AppSetting.DailyDigestEnabled)) {
        return;
    }

    const digestEntries = Object.entries(queue).map(([username, problematicItemsResult]) => ({ username, problematicItemsResult: JSON.parse(problematicItemsResult) as ProblematicSubsResultWithItem }));
    if (digestEntries.length === 0) {
        console.log("Daily Digest: No entries to include in the digest.");
        return;
    }

    const digestMessage: json2md.DataObject[] = [
        { p: "Here is the daily digest of users who have triggered Hive Protector's checks:" },
    ];

    const rows: string[][] = digestEntries.map(entry => [
        `/u/${entry.username}`,
        getPostOrCommentLink(entry.problematicItemsResult.targetId, entry.problematicItemsResult.sourceUrl),
        entry.problematicItemsResult.badSubs.map(sub => `/r/${sub}`).join(", "),
        entry.problematicItemsResult.badDomains.join(", "),
    ]);

    digestMessage.push({
        table: {
            headers: ["Username", "Latest Post/Comment", "Detected Subs", "Detected Domains"],
            rows,
        },
    });

    digestMessage.push({ p: `*This message was generated automatically by Hive Protector. To turn this notification off, go to the [app settings page](https://developers.reddit.com/r/${context.subredditName}/apps/${context.appSlug}) and disable the daily digest.*` });

    await reddit.modMail.createModInboxConversation({
        subredditId: context.subredditId,
        subject: "Hive Protector Daily Digest",
        bodyMarkdown: json2md(digestMessage),
    });

    console.log(`Daily Digest: Sent digest for ${digestEntries.length} ${digestEntries.length === 1 ? "user" : "users"}.`);
}
