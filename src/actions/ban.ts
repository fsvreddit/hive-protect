import { TriggerContext } from "@devvit/public-api";
import { ProblematicSubsResult } from "../getProblematicItems.js";
import { AppSetting } from "../settings.js";
import { setCleanupForUser } from "../cleanupTasks.js";
import { isBanned } from "../utility.js";

export async function banUser (context: TriggerContext, subredditName: string, userName: string, problematicItemsResult: ProblematicSubsResult): Promise<void> {
    // Check to see if user is banned first before acting.
    const userIsBanned = await isBanned(context, subredditName, userName);
    if (userIsBanned) {
        console.log(`Skipping ban for ${userName}, user is already banned.`);
        return;
    }

    const settings = await context.settings.getAll();

    let banMessage = settings[AppSetting.BanMessage] as string | undefined;
    if (banMessage) {
        banMessage = banMessage.replace("{{sublist}}", problematicItemsResult.badSubs.join(", "));
        banMessage = banMessage.replace("{{domainlist}}", problematicItemsResult.badDomains.join(", "));
        banMessage = banMessage.replace("{{socialurls}}", problematicItemsResult.socialURLs.join("  \n"));
        banMessage = banMessage.replace("{{permalink}}", problematicItemsResult.itemPermalink ?? "");
        banMessage = banMessage.replace("{{username}}", userName);
    }
    const banNote = settings[AppSetting.BanNote] as string | undefined;

    let banDuration = settings[AppSetting.BanDuration] as number | undefined;
    if (banDuration === 0) {
        banDuration = undefined;
    }

    let banReason: string;
    if (banNote) {
        banReason = `Hive Protector: ${banNote}`;
    } else {
        banReason = "Banned by Hive Protector. Matches in {{sublist}}";
    }

    banReason = banReason.replace("{{sublist}}", problematicItemsResult.badSubs.join(", "));
    banReason = banReason.replace("{{domainlist}}", problematicItemsResult.badDomains.join(", "));

    await context.reddit.banUser({
        username: userName,
        reason: banReason.slice(0, 100),
        message: banMessage?.slice(0, 1000),
        subredditName,
        duration: banDuration,
    });

    await context.redis.set(`participation-prevbanned-${userName}`, new Date().getTime().toString());
    await setCleanupForUser(userName, context);

    console.log(`Banned ${userName} from ${subredditName}`);
}
