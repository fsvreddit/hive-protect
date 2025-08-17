import { Comment } from "@devvit/public-api";
import { AppSetting } from "../settings.js";
import { ActionBase } from "./_ActionBase.js";

export class ActionWebhookNotification extends ActionBase {
    public async execute (): Promise<void> {
        const webhookUrl = this.settings[AppSetting.DiscordOrSlackWebhook] as string | undefined;
        if (!webhookUrl) {
            return;
        }

        const subredditName = this.context.subredditName ?? await this.context.reddit.getCurrentSubredditName();

        const suppressEmbeds = this.settings[AppSetting.DiscordSuppressEmbeds] as boolean | undefined ?? false;

        let message = `/u/${this.target.authorName} has been flagged by Hive Protector on /r/${subredditName}.\n`;
        if (this.problematicItemsResult.badSubs.length > 0) {
            message += `* Problematic Subreddits found: ${this.problematicItemsResult.badSubs.join(", ")}\n`;
        }

        if (this.problematicItemsResult.badDomains.length > 0) {
            message += `* Problematic Domains found: ${this.problematicItemsResult.badDomains.join(", ")}\n`;
        }

        const kind = this.target instanceof Comment ? "comment" : "post";
        if (webhookUrl.includes("slack.com") || !suppressEmbeds) {
            message += `User was caught after making [this ${kind}](${this.target.permalink}).`;
        } else {
            message += `User was caught after making [this ${kind}](<${this.target.permalink}>).`;
        }

        let params;
        if (webhookUrl.includes("discord.com") || webhookUrl.includes("discordapp.com")) {
            params = {
                content: message,
            };
        } else {
            params = {
                text: message,
            };
        }

        try {
            await fetch(
                webhookUrl,
                {
                    method: "post",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(params),
                },
            );
            console.log("Alert sent to webhook");
        } catch (error) {
            console.log(error);
        }
    }
}
