import { Comment, Post, SettingsValues, TriggerContext } from "@devvit/public-api";
import { ProblematicSubsResult } from "../getProblematicItems.js";
import { AppSetting } from "../settings.js";
import { APPROVALS_KEY } from "../handleContentCreation.js";
import json2md from "json2md";

export async function sendModmail (target: Post | Comment, problematicItemsResult: ProblematicSubsResult, settings: SettingsValues, context: TriggerContext) {
    if (!settings[AppSetting.ModmailEnabled]) {
        return;
    }

    const allowlistThreshold = settings[AppSetting.ModmailNumber] as number | undefined ?? 3;
    let shouldModmail = true;
    let currentApprovalCount: number | undefined;
    if (allowlistThreshold) {
        try {
            currentApprovalCount = await context.redis.zScore(APPROVALS_KEY, target.authorName);
            if (currentApprovalCount !== undefined && currentApprovalCount >= allowlistThreshold) {
                console.log(`User ${target.authorName} has too many approvals to report.`);
                shouldModmail = false;
            }
        } catch {
            // User has no approvals, so always modmail.
        }
    }

    if (!shouldModmail) {
        console.log(`User ${target.authorName} has too many approvals to modmail.`);
        return;
    }

    const message: json2md.DataObject[] = [
        { p: `User /u/${target.authorName} has been identified by Hive Protector as potentially having undesirable history.` },
    ];

    const bullets: string[] = [];
    if (problematicItemsResult.badSubs.length > 0) {
        bullets.push(`* Problematic Subreddits found: ${problematicItemsResult.badSubs.join(", ")}`);
    }

    if (problematicItemsResult.badDomains.length > 0) {
        bullets.push(`* Problematic Domains found: ${problematicItemsResult.badDomains.join(", ")}`);
    }

    if (bullets.length > 0) {
        message.push({ ul: bullets });
    }

    message.push({ p: `User was caught after making [this post or comment](${target.permalink}).` });

    await context.reddit.modMail.createModInboxConversation({
        subredditId: context.subredditId,
        subject: `Hive Protector notice for /u/${target.authorName}`,
        bodyMarkdown: json2md(message),
    });

    console.log("Modmail sent.");
}
