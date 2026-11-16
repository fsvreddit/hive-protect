import { context, reddit } from "@devvit/web/server";
import { AppSetting, PurgeOption } from "..";
import { ActionBase } from "./_ActionBase.js";

export class ActionRemove extends ActionBase {
    public override isModuleEnabled (): boolean {
        return super.isModuleEnabled() && this.settings[AppSetting.RemoveEnabled] === true;
    }

    public async execute () {
        const removeAsSpam = this.settings[AppSetting.RemoveAsSpam] as boolean | undefined ?? false;

        const promises = [this.target.remove(removeAsSpam)];

        const [purgeOption] = this.settings[AppSetting.PurgeContent] as PurgeOption[] | undefined ?? [PurgeOption.None];
        if (purgeOption !== PurgeOption.None) {
            let timeframe: "day" | "week" | "month" | undefined;
            if (purgeOption === PurgeOption.LastDay || purgeOption === PurgeOption.LastWeek || purgeOption === PurgeOption.LastMonth) {
                timeframe = purgeOption;
            }

            let userContent = await reddit.getCommentsAndPostsByUser({
                username: this.target.authorName,
                timeframe,
                limit: 1000,
            }).all();

            userContent = userContent.filter(item => item.subredditId === context.subredditId);

            promises.push(...userContent.map(item => item.remove(removeAsSpam)));
        }

        const result = await Promise.all(promises);
        console.log(`Removed ${result.length} user content items`);
    }
}
