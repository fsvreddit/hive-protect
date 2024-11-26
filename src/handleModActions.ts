import { ModAction } from "@devvit/protos";
import { TriggerContext } from "@devvit/public-api";
import { getLatestResultKey } from "./getProblematicItems.js";
import { setCleanupForUser } from "./cleanupTasks.js";
import { APPROVALS_KEY } from "./handleContentCreation.js";
import { dequeueSecondCheck } from "./secondChecks.js";

export async function handleModActionEvent (event: ModAction, context: TriggerContext) {
    if (event.targetUser && (event.action === "unbanuser" || event.action === "banuser")) {
        console.log(`Detected a ${event.action} event for ${event.targetUser.name}. Removing cached check results that may exist.`);
        // Clear down previous check after unban
        await context.redis.del(getLatestResultKey(event.targetUser.name));
        await dequeueSecondCheck(event.targetUser.name, context);
    }

    if (event.targetUser && (event.action === "approvecomment" || event.action === "approvelink")) {
        let targetId: string | undefined;
        if (event.action === "approvecomment") {
            targetId = event.targetComment?.id;
        } else {
            targetId = event.targetPost?.id;
        }

        if (!targetId) {
            // This should be impossible, but handle anyway.
            return;
        }

        // Check to see if post/comment was previously flagged by this app.
        const itemReported = await context.redis.get(`itemreported~${targetId}`);
        if (!itemReported) {
            return;
        }

        // Increment approvals counter.
        const newApprovalCount = await context.redis.zIncrBy(APPROVALS_KEY, event.targetUser.name, 1);
        await setCleanupForUser(event.targetUser.name, context);
        console.log(`Approved a reported comment by ${event.targetUser.name}. Approval counter is now ${newApprovalCount}.`);
    }
}
