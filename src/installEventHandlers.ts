import {TriggerContext} from "@devvit/public-api";
import {AppUpgrade} from "@devvit/protos";

export async function handleAppUpgradeEvent (event: AppUpgrade, context: TriggerContext) {
    // Clean up old redis key, no longer used.
    await context.redis.del("subredditName");
}
