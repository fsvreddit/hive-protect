import { Comment, Post, TriggerContext, UserNoteLabel } from "@devvit/public-api";
import { AppSetting } from "../settings.js";
import { replaceAll } from "../utility.js";
import { ToolboxClient, UsernoteInit } from "toolbox-devvit";
import { ActionBase } from "./_ActionBase.js";

export class ActionAddModnote extends ActionBase {
    public override isModuleEnabled (): boolean {
        return super.isModuleEnabled() && this.settings[AppSetting.ModNoteEnabled] === true;
    }

    public async execute (): Promise<void> {
        const [modNoteType] = this.settings[AppSetting.ModNoteType] as [string | undefined];

        let modNote = this.settings[AppSetting.ModNoteTemplate] as string | undefined;
        if (!modNote) {
            return;
        }

        modNote = replaceAll(modNote, "{{sublist}}", this.problematicItemsResult.badSubs.join(", "));
        modNote = replaceAll(modNote, "{{domainlist}}", this.problematicItemsResult.badDomains.join(", "));

        const redisKey = `modNoteAdded:${this.target.authorName}`;
        const alreadyAdded = await this.context.redis.get(redisKey);
        if (alreadyAdded) {
            return;
        }

        const promises: Promise<unknown>[] = [];
        if (modNoteType === "native" || modNoteType === "both") {
            const label: UserNoteLabel = this.settings[AppSetting.BanEnabled] ? "BOT_BAN" : "ABUSE_WARNING";
            promises.push(this.addNativeNote(this.target, modNote, label, this.context));
        }

        if (modNoteType === "toolbox" || modNoteType === "both") {
            promises.push(this.addToolboxNote(this.target, modNote, this.context));
        }

        promises.push(this.context.redis.set(redisKey, new Date().getTime().toString()));

        await Promise.all(promises);
        console.log(`Added mod note for ${this.target.authorName} on ${this.target.id}`);
    }

    private async addNativeNote (target: Post | Comment, note: string, type: UserNoteLabel, context: TriggerContext) {
        const subredditName = await context.reddit.getCurrentSubredditName();
        await context.reddit.addModNote({
            subreddit: subredditName,
            note,
            user: target.authorName,
            label: type,
            redditId: target.id,
        });
    }

    private async addToolboxNote (target: Post | Comment, note: string, context: TriggerContext) {
        const toolbox = new ToolboxClient(context.reddit);
        const subredditName = await context.reddit.getCurrentSubredditName();

        const usernote: UsernoteInit = {
            text: note,
            username: target.authorName,
            contextPermalink: target.permalink,
            timestamp: new Date(),
        };

        await toolbox.addUsernote(subredditName, usernote, undefined);
    }
}
