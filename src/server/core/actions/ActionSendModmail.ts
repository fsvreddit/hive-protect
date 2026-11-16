import { context, reddit, redis } from "@devvit/web/server";
import { AppSetting } from "..";
import { APPROVALS_KEY } from "..";
import json2md from "json2md";
import { ActionBase } from "./_ActionBase.js";

export class ActionSendModmail extends ActionBase {
    public override isModuleEnabled (): boolean {
        return super.isModuleEnabled() && this.settings[AppSetting.ModmailEnabled] === true;
    }

    public async execute (): Promise<void> {
        const allowlistThreshold = this.settings[AppSetting.ModmailNumber] as number | undefined ?? 3;
        let shouldModmail = true;
        let currentApprovalCount: number | undefined;
        if (allowlistThreshold) {
            try {
                currentApprovalCount = await redis.zScore(APPROVALS_KEY, this.target.authorName);
                if (currentApprovalCount !== undefined && currentApprovalCount >= allowlistThreshold) {
                    console.log(`User ${this.target.authorName} has too many approvals to report.`);
                    shouldModmail = false;
                }
            } catch {
                // User has no approvals, so always modmail.
            }
        }

        if (!shouldModmail) {
            console.log(`User ${this.target.authorName} has too many approvals to modmail.`);
            return;
        }

        const message: json2md.DataObject[] = [
            { p: `User /u/${this.target.authorName} has been identified by Hive Protector as potentially having undesirable history.` },
        ];

        const bullets: string[] = [];
        if (this.problematicItemsResult.badSubs.length > 0) {
            bullets.push(`Problematic Subreddits found: ${this.problematicItemsResult.badSubs.join(", ")}`);
        }

        if (this.problematicItemsResult.badDomains.length > 0) {
            bullets.push(`Problematic Domains found: ${this.problematicItemsResult.badDomains.join(", ")}`);
        }

        if (bullets.length > 0) {
            message.push({ ul: bullets });
        }

        message.push({ p: `User was caught after making [this post or comment](${this.target.permalink}).` });

        await reddit.modMail.createModInboxConversation({
            subredditId: context.subredditId,
            subject: `Hive Protector notice for /u/${this.target.authorName}`,
            bodyMarkdown: json2md(message),
        });

        console.log("Modmail sent.");
    }
}
