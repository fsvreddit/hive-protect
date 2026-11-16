import { reddit, redis } from "@devvit/web/server";
import { APPROVALS_KEY, AppSetting } from "..";
import { addDays } from "date-fns";
import { ActionBase } from "./_ActionBase.js";

export class ActionReport extends ActionBase {
    public async execute (): Promise<void> {
        const removeEnabled = this.settings[AppSetting.RemoveEnabled] as boolean | undefined ?? true;
        const reportEnabled = this.settings[AppSetting.ReportEnabled] as boolean | undefined ?? false;
        let reportReason = this.settings[AppSetting.ReportTemplate] as string | undefined;

        if (!reportEnabled || !reportReason || removeEnabled) {
            return;
        }

        const allowlistThreshold = this.settings[AppSetting.ReportNumber] as number | undefined ?? 3;
        let shouldReport = true;
        let currentApprovalCount: number | undefined;
        if (allowlistThreshold) {
            try {
                currentApprovalCount = await redis.zScore(APPROVALS_KEY, this.target.authorName);
                if (currentApprovalCount !== undefined && currentApprovalCount >= allowlistThreshold) {
                    console.log(`User ${this.target.authorName} has too many approvals to report.`);
                    shouldReport = false;
                }
            } catch {
            // User has no approvals, so always report.
            }
        }

        if (shouldReport) {
            reportReason = reportReason.replaceAll("{{sublist}}", this.problematicItemsResult.badSubs.join(", "));
            reportReason = reportReason.replaceAll("{{domainlist}}", this.problematicItemsResult.badDomains.join(", "));
            reportReason = reportReason.replaceAll("{{approvals}}", currentApprovalCount?.toString() ?? "0");

            if (reportReason.length > 100) {
                reportReason = reportReason.substring(0, 97) + "...";
            }

            await reddit.report(this.target, { reason: reportReason });
            await redis.set(`itemreported~${this.target.id}`, new Date().getTime().toString(), { expiration: addDays(new Date(), 7) });
            console.log(`Reported comment ${this.target.id}`);
        }
    }
}
