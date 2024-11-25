import { TriggerContext, User } from "@devvit/public-api";
import { ProblematicSubsResult } from "./getProblematicItems.js";
import { getPostOrCommentById } from "./utility.js";
import { reportContent } from "./actions/report.js";
import { removeContent } from "./actions/remove.js";
import { sendModmail } from "./actions/modmail.js";
import { replyToContent } from "./actions/reply.js";
import { banUser } from "./actions/ban.js";
import { AppSetting } from "./settings.js";

export async function actionUser (userName: string, targetId: string, problematicItemsResult: ProblematicSubsResult, context: TriggerContext) {
    const settings = await context.settings.getAll();

    let user: User | undefined;
    try {
        user = await context.reddit.getUserByUsername(userName);
    } catch {
        //
    }

    if (!user) {
        console.log("User object is not defined. This should be impossible if we checked user.");
        return;
    }

    if (user.isAdmin) {
        console.log(`${userName} is an admin! No action will be taken.`);
        return;
    }

    const subredditName = context.subredditName ?? (await context.reddit.getCurrentSubreddit()).name;

    const userFlairWhitelist = settings[AppSetting.FlairWhitelist] as string | undefined;
    if (userFlairWhitelist) {
        const whitelistedFlairs = userFlairWhitelist.split(",").map(x => x.toLowerCase().trim());
        const userFlair = await user.getUserFlairBySubreddit(subredditName);
        if (userFlair?.flairText && whitelistedFlairs.includes(userFlair.flairText.toLowerCase())) {
            console.log(`User's flair (${userFlair.flairText} is whitelisted. No action will be taken,`);
            return;
        }
    }

    const banEnabled = settings[AppSetting.BanEnabled] as boolean | undefined ?? true;

    const target = await getPostOrCommentById(targetId, context);

    const actions: Promise<void>[] = [];

    if (banEnabled && problematicItemsResult.userBannable) {
        actions.push(banUser(context, subredditName, userName, problematicItemsResult));
    }

    if (!settings[AppSetting.ApplyBanBehavioursToOtherActions] && !problematicItemsResult.userBannable) {
        console.log("Other action options are turned on, but user was previously unbanned. Skipping");
        return;
    }

    // Perform actions!
    actions.push(
        reportContent(target, problematicItemsResult, settings, context),
        removeContent(target, settings, context),
        replyToContent(target, problematicItemsResult, settings, context),
        sendModmail(target, problematicItemsResult, settings, context),
    );
}
