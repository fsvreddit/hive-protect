import { AppSetting } from "../settings.js";
import { replaceAll } from "../utility.js";
import { isLinkId } from "@devvit/shared-types/tid.js";
import pluralize from "pluralize";
import { ActionBase } from "./_ActionBase.js";

export class ActionReply extends ActionBase {
    public async execute (): Promise<void> {
        let replyMessage = this.settings[AppSetting.ReplyTemplate] as string | undefined;
        if (!replyMessage) {
            return;
        }

        replyMessage = replaceAll(replyMessage, "{{sublist}}", this.problematicItemsResult.badSubs.join(", "));
        replyMessage = replaceAll(replyMessage, "{{domainlist}}", this.problematicItemsResult.badDomains.join(", "));
        replyMessage = replaceAll(replyMessage, "{{socialurls}}", this.problematicItemsResult.socialURLs.join("  \n"));
        replyMessage = replaceAll(replyMessage, "{{permalink}}", this.problematicItemsResult.itemPermalink ?? "");
        replyMessage = replaceAll(replyMessage, "{{username}}", this.target.authorName);

        replyMessage = this.sanitiseOutput(replyMessage);

        replyMessage = `${replyMessage.trim()}\n\n*I am a bot, and this action was performed automatically. Please [contact the moderators of this subreddit](/message/compose/?to=/r/${this.target.subredditName}) if you have any questions or concerns.*`;

        const newComment = await this.context.reddit.submitComment({ id: this.target.id, text: replyMessage });
        const shouldSticky = isLinkId(this.target.id) && (this.settings[AppSetting.StickyReply] as boolean | undefined ?? false);
        await newComment.distinguish(shouldSticky);
        if (this.settings[AppSetting.LockReply]) {
            await newComment.lock();
        }
        console.log(`Reply left on ${this.target.id}`);
    }

    private sanitiseOutput (input: string): string {
        const sitewideBannedDomains = this.settings[AppSetting.SitewideBannedDomains] as string | undefined ?? "";
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
}
