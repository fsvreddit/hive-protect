import { Comment, Post, SettingsValues, TriggerContext } from "@devvit/public-api";
import { AppSetting } from "../settings.js";
import { replaceAll } from "../utility.js";
import { ProblematicSubsResult } from "../getProblematicItems.js";
import { isLinkId } from "@devvit/shared-types/tid.js";
import pluralize from "pluralize";

async function sanitiseOutput (input: string, context: TriggerContext): Promise<string> {
    const sitewideBannedDomains = await context.settings.get<string>(AppSetting.SitewideBannedDomains) ?? "";
    const sitewideBannedDomainsArray = sitewideBannedDomains.split(",").map(domain => domain.trim());

    let result = input;
    let replacementsOccurred = 0;
    for (const domain of sitewideBannedDomainsArray) {
        if (result.includes(domain)) {
            result = replaceAll(result, domain, "[REDACTED]");
            replacementsOccurred++;
        }
    }

    if (replacementsOccurred) {
        result += `\n\n*${replacementsOccurred} known sitewide banned ${pluralize("domain", replacementsOccurred)} have been redacted from this comment.*`;
    }

    return result;
}

export async function replyToContent (target: Post | Comment, problematicItemsResult: ProblematicSubsResult, settings: SettingsValues, context: TriggerContext) {
    let replyMessage = settings[AppSetting.ReplyTemplate] as string | undefined;
    if (replyMessage) {
        replyMessage = replaceAll(replyMessage, "{{sublist}}", problematicItemsResult.badSubs.join(", "));
        replyMessage = replaceAll(replyMessage, "{{domainlist}}", problematicItemsResult.badDomains.join(", "));
        replyMessage = replaceAll(replyMessage, "{{socialurls}}", problematicItemsResult.socialURLs.join("  \n"));
        replyMessage = replaceAll(replyMessage, "{{permalink}}", problematicItemsResult.itemPermalink ?? "");
        replyMessage = replaceAll(replyMessage, "{{username}}", target.authorName);

        replyMessage = await sanitiseOutput(replyMessage, context);

        replyMessage = `${replyMessage.trim()}\n\n*I am a bot, and this action was performed automatically. Please [contact the moderators of this subreddit](/message/compose/?to=/r/${target.subredditName}) if you have any questions or concerns.*`;

        const newComment = await context.reddit.submitComment({ id: target.id, text: replyMessage });
        const shouldSticky = isLinkId(target.id) && (settings[AppSetting.StickyReply] as boolean | undefined ?? false);
        await newComment.distinguish(shouldSticky);
        if (settings[AppSetting.LockReply]) {
            await newComment.lock();
        }
        console.log(`Reply left on ${target.id}`);
    }
}
