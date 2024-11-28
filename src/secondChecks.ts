import { JobContext, TriggerContext } from "@devvit/public-api";
import { addDays, addHours, addSeconds, differenceInMinutes } from "date-fns";
import { parseExpression } from "cron-parser";
import { SECOND_CHECK_JOB, SECOND_CHECK_JOB_CRON } from "./constants.js";
import { problematicItemsFound } from "./getProblematicItems.js";
import { actionUser } from "./actionUser.js";

const SECOND_CHECK_QUEUE = "secondCheckQueue";

export async function queueSecondCheck (username: string, interval: number, context: TriggerContext) {
    const secondCheckedKey = `secondchecked~${username}`;
    const secondChecked = await context.redis.get(secondCheckedKey);
    if (secondChecked) {
        return;
    }

    const score = await context.redis.zScore(SECOND_CHECK_QUEUE, username);
    if (score) {
        return;
    }

    await context.redis.zAdd(SECOND_CHECK_QUEUE, { member: username, score: addHours(new Date(), interval).getTime() });

    await context.redis.set(secondCheckedKey, new Date().getTime().toString(), { expiration: addDays(new Date(), 28) });
}

export async function dequeueSecondCheck (username: string, context: TriggerContext) {
    await context.redis.zRem(SECOND_CHECK_QUEUE, [username]);
}

export async function handleSecondCheckJob (_: unknown, context: JobContext) {
    const entries = await context.redis.zRange(SECOND_CHECK_QUEUE, 0, new Date().getTime(), { by: "rank" });

    if (entries.length > 0) {
        const usersToProcess = entries.slice(0, 5).map(item => item.member);
        await context.redis.zRem(SECOND_CHECK_QUEUE, usersToProcess);

        const subredditName = context.subredditName ?? (await context.reddit.getCurrentSubreddit()).name;

        for (const username of usersToProcess) {
            console.log(`Second check for ${username}`);
            const problematicItemsResult = await problematicItemsFound(context, subredditName, username, true);
            if (problematicItemsResult.badSubs.length === 0 && problematicItemsResult.badDomains.length === 0) {
                continue;
            }

            await actionUser(username, undefined, problematicItemsResult, context);
        }
    }

    await queueSecondCheckAdhocJob(context);
}

export async function queueSecondCheckAdhocJob (context: TriggerContext) {
    const nextEntries = await context.redis.zRange(SECOND_CHECK_QUEUE, 0, 0, { by: "rank" });
    if (nextEntries.length === 0) {
        console.log("No adhoc job needed, nothing in queue");
        return;
    }

    const nextRunTime = addSeconds(new Date(nextEntries[0].score), 1);
    const nextScheduledTime = parseExpression(SECOND_CHECK_JOB_CRON).next().toDate();

    if (differenceInMinutes(nextScheduledTime, nextRunTime) < 2) {
        console.log(`No adhoc job needed, next scheduled check is ${nextScheduledTime.toUTCString()}`);
        console.log(`Next ad-hoc: ${nextRunTime.toUTCString()}`);
        return;
    }

    await context.scheduler.runJob({
        name: SECOND_CHECK_JOB,
        runAt: nextRunTime,
    });

    console.log(`Next ad-hoc check: ${nextRunTime.toUTCString()}`);
}
