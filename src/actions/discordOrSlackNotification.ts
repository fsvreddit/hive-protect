import { Comment, Post, SettingsValues } from "@devvit/public-api";
import { ProblematicSubsResult } from "../getProblematicItems.js";
import { AppSetting } from "../settings.js";

export async function sendDiscordOrSlackNotification (target: Post | Comment, problematicItemsResult: ProblematicSubsResult, settings: SettingsValues) {
    const webhookUrl = settings[AppSetting.DiscordOrSlackWebhook] as string | undefined;
    if (!webhookUrl) {
        return;
    }

    const suppressEmbeds = settings[AppSetting.DiscordSuppressEmbeds] as boolean | undefined ?? false;

    let message = `/u/${target.authorName} has been flagged by Hive Protector.\n`;
    if (problematicItemsResult.badSubs.length > 0) {
        message += `* Problematic Subreddits found: ${problematicItemsResult.badSubs.join(", ")}\n`;
    }

    if (problematicItemsResult.badDomains.length > 0) {
        message += `* Problematic Domains found: ${problematicItemsResult.badDomains.join(", ")}\n`;
    }

    const kind = target instanceof Comment ? "comment" : "post";
    if (webhookUrl.includes("slack.com") || !suppressEmbeds) {
        message += `User was caught after making [this ${kind}](${target.permalink}).`;
    } else {
        message += `User was caught after making [this ${kind}](<${target.permalink}>).`;
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
