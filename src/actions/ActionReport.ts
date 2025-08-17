import { APPROVALS_KEY } from "../handleContentCreation.js";
import { replaceAll } from "../utility.js";
import { addDays } from "date-fns";
import { AppSetting } from "../settings.js";
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
                currentApprovalCount = await this.context.redis.zScore(APPROVALS_KEY, this.target.authorName);
                if (currentApprovalCount !== undefined && currentApprovalCount >= allowlistThreshold) {
                    console.log(`User ${this.target.authorName} has too many approvals to report.`);
                    shouldReport = false;
                }
            } catch {
            // User has no approvals, so always report.
            }
        }

        if (shouldReport) {
            reportReason = replaceAll(reportReason, "{{sublist}}", this.problematicItemsResult.badSubs.join(", "));
            reportReason = replaceAll(reportReason, "{{domainlist}}", this.problematicItemsResult.badDomains.join(", "));
            reportReason = replaceAll(reportReason, "{{approvals}}", currentApprovalCount?.toString() ?? "0");
            await this.context.reddit.report(this.target, { reason: reportReason });
            await this.context.redis.set(`itemreported~${this.target.id}`, new Date().getTime.toString(), { expiration: addDays(new Date(), 7) });
            console.log(`Reported comment ${this.target.id}`);
        }
    }
}
