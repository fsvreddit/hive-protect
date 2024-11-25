import { Comment, Post, SettingsValues, TriggerContext } from "@devvit/public-api";
import { APPROVALS_KEY } from "../hiveProtect.js";
import { ProblematicSubsResult } from "../getProblematicItems.js";
import { replaceAll } from "../utility.js";
import { addDays } from "date-fns";
import { AppSetting } from "../settings.js";

export async function reportContent (target: Post | Comment, problematicItemsResult: ProblematicSubsResult, settings: SettingsValues, context: TriggerContext) {
    const removeEnabled = settings[AppSetting.RemoveEnabled] as boolean | undefined ?? true;
    const reportEnabled = settings[AppSetting.ReportEnabled] as boolean | undefined ?? false;
    let reportReason = settings[AppSetting.ReportTemplate] as string | undefined;

    if (!reportEnabled || !reportReason || removeEnabled) {
        return;
    }

    const whitelistThreshold = settings[AppSetting.ReportNumber] as number | undefined ?? 3;
    let shouldReport = true;
    if (whitelistThreshold) {
        try {
            const currentApprovalCount = await context.redis.zScore(APPROVALS_KEY, target.authorName);
            if (currentApprovalCount !== undefined && currentApprovalCount >= whitelistThreshold) {
                console.log(`User ${target.authorName} has too many approvals to report.`);
                shouldReport = false;
            }
        } catch {
            // User has no approvals, so always report.
        }
    }

    if (shouldReport) {
        reportReason = replaceAll(reportReason, "{{sublist}}", problematicItemsResult.badSubs.join(", "));
        reportReason = replaceAll(reportReason, "{{domainlist}}", problematicItemsResult.badDomains.join(", "));
        await context.reddit.report(target, { reason: reportReason });
        await context.redis.set(`itemreported~${target.id}`, new Date().getTime.toString(), { expiration: addDays(new Date(), 7) });
        console.log(`Reported comment ${target.id}`);
    }
}
