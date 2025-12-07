import { AppSetting } from "../settings.js";
import { setCleanupForUser } from "../cleanupTasks.js";
import { ActionBase } from "./_ActionBase.js";
import { isBanned } from "devvit-helpers";

export class ActionBan extends ActionBase {
    public override isModuleEnabled (): boolean {
        const banEnabled = this.settings[AppSetting.BanEnabled] as boolean | undefined ?? true;
        return banEnabled && this.problematicItemsResult.userBannable;
    }

    public async execute (): Promise<void> {
        const banEnabled = this.settings[AppSetting.BanEnabled] as boolean | undefined ?? true;

        if (!banEnabled || !this.problematicItemsResult.userBannable) {
            return;
        }

        const userName = this.target.authorName;
        const subredditName = this.context.subredditName ?? await this.context.reddit.getCurrentSubredditName();

        const userIsBanned = await isBanned(this.context.reddit, subredditName, userName);
        if (userIsBanned) {
            console.log(`Skipping ban for ${userName}, user is already banned.`);
            return;
        }

        let banMessage = this.settings[AppSetting.BanMessage] as string | undefined;
        if (banMessage) {
            banMessage = banMessage.replaceAll("{{sublist}}", this.problematicItemsResult.badSubs.join(", "));
            banMessage = banMessage.replaceAll("{{domainlist}}", this.problematicItemsResult.badDomains.join(", "));
            banMessage = banMessage.replaceAll("{{socialurls}}", this.problematicItemsResult.socialURLs.join(", "));
            banMessage = banMessage.replaceAll("{{permalink}}", this.problematicItemsResult.itemPermalink ?? "");
            banMessage = banMessage.replaceAll("{{username}}", userName);
        }
        const banNote = this.settings[AppSetting.BanNote] as string | undefined;

        let banDuration = this.settings[AppSetting.BanDuration] as number | undefined;
        if (banDuration === 0) {
            banDuration = undefined;
        }

        let banReason: string;
        if (banNote) {
            banReason = `Hive Protector: ${banNote}`;
        } else {
            banReason = "Banned by Hive Protector. Matches in {{sublist}}";
        }

        banReason = banReason.replace("{{sublist}}", this.problematicItemsResult.badSubs.join(", "));
        banReason = banReason.replace("{{domainlist}}", this.problematicItemsResult.badDomains.join(", "));

        await this.context.reddit.banUser({
            username: userName,
            reason: banReason.slice(0, 100),
            message: banMessage?.slice(0, 1000),
            subredditName,
            duration: banDuration,
        });

        await this.context.redis.set(`participation-prevbanned-${userName}`, new Date().getTime().toString());
        await setCleanupForUser(userName, this.context);

        console.log(`Banned ${userName} from ${subredditName}`);
    }
}
