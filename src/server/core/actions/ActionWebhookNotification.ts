import { context } from "@devvit/web/server";
import { isT1 } from "@devvit/web/shared";
import { AppSetting } from "..";
import { ActionBase } from "./_ActionBase.js";

export class ActionWebhookNotification extends ActionBase {
    public async execute (): Promise<void> {
        const webhookUrl = this.settings[AppSetting.DiscordOrSlackWebhook] as string | undefined;
        if (!webhookUrl) {
            return;
        }

        const suppressEmbeds = this.settings[AppSetting.DiscordSuppressEmbeds] as boolean | undefined ?? false;

        let message = `/u/${this.target.authorName} has been flagged by Hive Protector on /r/${context.subredditName}.\n`;
        if (this.problematicItemsResult.badSubs.length > 0) {
            message += `* Problematic Subreddits found: ${this.problematicItemsResult.badSubs.join(", ")}\n`;
        }

        if (this.problematicItemsResult.badDomains.length > 0) {
            message += `* Problematic Domains found: ${this.problematicItemsResult.badDomains.join(", ")}\n`;
        }

        const kind = isT1(this.target.id) ? "comment" : "post";
        if (webhookUrl.includes("slack.com") || !suppressEmbeds) {
            message += `User was caught after making [this ${kind}](https://www.reddit.com${this.target.permalink}).`;
        } else {
            message += `User was caught after making [this ${kind}](<https://www.reddit.com${this.target.permalink}>).`;
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
