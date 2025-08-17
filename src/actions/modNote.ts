import { Comment, Post, SettingsValues, TriggerContext, UserNoteLabel } from "@devvit/public-api";
import { AppSetting } from "../settings.js";
import { replaceAll } from "../utility.js";
import { ProblematicSubsResult } from "../getProblematicItems.js";
import { ToolboxClient, UsernoteInit } from "toolbox-devvit";

export async function addModNote (target: Post | Comment, problematicItemsResult: ProblematicSubsResult, settings: SettingsValues, context: TriggerContext) {
    if (!settings[AppSetting.ModNoteEnabled]) {
        return;
    }

    const [modNoteType] = settings[AppSetting.ModNoteType] as [string | undefined];

    let modNote = settings[AppSetting.ModNoteTemplate] as string | undefined;
    if (!modNote) {
        return;
    }

    modNote = replaceAll(modNote, "{{sublist}}", problematicItemsResult.badSubs.join(", "));
    modNote = replaceAll(modNote, "{{domainlist}}", problematicItemsResult.badDomains.join(", "));

    const redisKey = `modNoteAdded:${target.authorName}`;
    const alreadyAdded = await context.redis.get(redisKey);
    if (alreadyAdded) {
        return;
    }

    const promises: Promise<unknown>[] = [];
    if (modNoteType === "native" || modNoteType === "both") {
        const label: UserNoteLabel = settings[AppSetting.BanEnabled] ? "BOT_BAN" : "ABUSE_WARNING";
        promises.push(addNativeNote(target, modNote, label, context));
    }

    if (modNoteType === "toolbox" || modNoteType === "both") {
        promises.push(addToolboxNote(target, modNote, context));
    }

    promises.push(context.redis.set(redisKey, new Date().getTime().toString()));

    await Promise.all(promises);
}

async function addNativeNote (target: Post | Comment, note: string, type: UserNoteLabel, context: TriggerContext) {
    const subredditName = await context.reddit.getCurrentSubredditName();
    await context.reddit.addModNote({
        subreddit: subredditName,
        note,
        user: target.authorName,
        label: type,
        redditId: target.id,
    });
}

async function addToolboxNote (target: Post | Comment, note: string, context: TriggerContext) {
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
