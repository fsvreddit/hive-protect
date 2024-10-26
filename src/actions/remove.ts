import { Comment, Post, SettingsValues, TriggerContext } from "@devvit/public-api";
import { AppSetting, PurgeOption } from "../settings.js";

export async function removeContent (target: Post | Comment, settings: SettingsValues, context: TriggerContext) {
    if (!settings[AppSetting.RemoveEnabled]) {
        return;
    }

    const removeAsSpam = settings[AppSetting.RemoveAsSpam] as boolean | undefined ?? false;

    const promises = [target.remove(removeAsSpam)];

    const [purgeOption] = settings[AppSetting.PurgeContent] as PurgeOption[] | undefined ?? [PurgeOption.None];
    if (purgeOption !== PurgeOption.None) {
        let timeframe: "day" | "week" | "month" | undefined;
        if (purgeOption === PurgeOption.LastDay || purgeOption === PurgeOption.LastWeek || purgeOption === PurgeOption.LastMonth) {
            timeframe = purgeOption;
        }

        let userContent = await context.reddit.getCommentsAndPostsByUser({
            username: target.authorName,
            timeframe,
            limit: 1000,
        }).all();

        userContent = userContent.filter(item => item.subredditId === context.subredditId);

        promises.push(...userContent.map(item => item.remove(removeAsSpam)));
    }

    const result = await Promise.all(promises);
    console.log(`Removed ${result.length} user content items`);
}
