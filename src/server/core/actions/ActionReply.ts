import { reddit, redis } from "@devvit/web/server";
import { isT3 } from "@devvit/web/shared";
import { AppSetting } from "..";
import pluralize from "pluralize";
import { ActionBase } from "./_ActionBase.js";
import { setCleanupForUser } from "../cleanupTasks.js";

export class ActionReply extends ActionBase {
    public async execute (): Promise<void> {
        let replyMessage = this.settings[AppSetting.ReplyTemplate] as string | undefined;
        if (!replyMessage) {
            return;
        }

        const maxReplyCount = this.settings[AppSetting.NumberOfRepliesToMake] as number | undefined ?? 0;
        const redisKey = `repliesMade:${this.target.authorName}`;

        if (maxReplyCount > 0) {
            const repliesMadeVal = await redis.get(redisKey);

            if (repliesMadeVal) {
                const repliesMade = parseInt(repliesMadeVal, 10);
                if (repliesMade >= maxReplyCount) {
                    console.log(`Max replies made for ${this.target.authorName}. Not replying.`);
                    return;
                }
            }
        }

        await redis.incrBy(redisKey, 1);
        await setCleanupForUser(this.target.authorName);

        replyMessage = replyMessage.replaceAll("{{sublist}}", this.problematicItemsResult.badSubs.join(", "));
        replyMessage = replyMessage.replaceAll("{{domainlist}}", this.problematicItemsResult.badDomains.join(", "));
        replyMessage = replyMessage.replaceAll("{{socialurls}}", this.problematicItemsResult.socialURLs.join(", "));
        replyMessage = replyMessage.replaceAll("{{permalink}}", this.problematicItemsResult.itemPermalink ?? "");
        replyMessage = replyMessage.replaceAll("{{username}}", this.target.authorName);
        replyMessage = this.sanitiseOutput(replyMessage);

        replyMessage = `${replyMessage.trim()}\n\n*I am a bot, and this action was performed automatically. Please [contact the moderators of this subreddit](/message/compose/?to=/r/${this.target.subredditName}) if you have any questions or concerns.*`;

        const newComment = await reddit.submitComment({ id: this.target.id, text: replyMessage });
        const shouldSticky = isT3(this.target.id) && (this.settings[AppSetting.StickyReply] as boolean | undefined ?? false);
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
                result = result.replaceAll(domain, "[REDACTED]");
                replacementsOccurred++;
            }
        }

        if (replacementsOccurred) {
            result += `\n\n*${replacementsOccurred} known sitewide banned ${pluralize("domain", replacementsOccurred)} have been redacted from this comment.*`;
        }

        return result;
    }
}
