import { Comment, context, Post, reddit, redis, UserNoteLabel } from "@devvit/web/server";
import { AppSetting } from "..";
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

        modNote = modNote.replaceAll("{{sublist}}", this.problematicItemsResult.badSubs.join(", "));
        modNote = modNote.replaceAll("{{domainlist}}", this.problematicItemsResult.badDomains.join(", "));

        const redisKey = `modNoteAdded:${this.target.authorName}`;
        const alreadyAdded = await redis.get(redisKey);
        if (alreadyAdded) {
            return;
        }

        const promises: Promise<unknown>[] = [];
        if (modNoteType === "native" || modNoteType === "both") {
            promises.push(this.addNativeNote(this.target, modNote, "ABUSE_WARNING"));
        }

        if (modNoteType === "toolbox" || modNoteType === "both") {
            promises.push(this.addToolboxNote(this.target, modNote));
        }

        promises.push(redis.set(redisKey, new Date().getTime().toString()));

        await Promise.all(promises);
        console.log(`Added mod note for ${this.target.authorName} on ${this.target.id}`);
    }

    private async addNativeNote (target: Post | Comment, note: string, type: UserNoteLabel) {
        await reddit.addModNote({
            subreddit: context.subredditName,
            note,
            user: target.authorName,
            label: type,
            redditId: target.id,
        });
    }

    private async addToolboxNote (target: Post | Comment, note: string) {
        const toolbox = new ToolboxClient(reddit);
        const usernote: UsernoteInit = {
            text: note,
            username: target.authorName,
            contextPermalink: target.permalink,
            timestamp: new Date(),
        };

        await toolbox.addUsernote(context.subredditName, usernote, undefined);
    }
}
