import { Post, Comment, TriggerContext, User, UserFlair } from "@devvit/public-api";
import { ProblematicSubsResult } from "./getProblematicItems.js";
import { getPostOrCommentById } from "./utility.js";
import { reportContent } from "./actions/report.js";
import { removeContent } from "./actions/remove.js";
import { sendModmail } from "./actions/modmail.js";
import { replyToContent } from "./actions/reply.js";
import { banUser } from "./actions/ban.js";
import { AppSetting } from "./settings.js";
import { addModNote } from "./actions/modNote.js";

export async function actionUser (userName: string, targetId: string | undefined, problematicItemsResult: ProblematicSubsResult, context: TriggerContext) {
    const settings = await context.settings.getAll();

    let user: User | undefined;
    try {
        user = await context.reddit.getUserByUsername(userName);
    } catch {
        //
    }

    if (!user) {
        console.log("User object is not defined. This could indicate a shadowbanned user on second check.");
        return;
    }

    if (user.isAdmin) {
        console.log(`${userName} is an admin! No action will be taken.`);
        return;
    }

    const subredditName = context.subredditName ?? (await context.reddit.getCurrentSubreddit()).name;

    const userFlairWhitelist = settings[AppSetting.FlairWhitelist] as string | undefined;
    const userFlairCSSClassWhitelist = settings[AppSetting.FlairCSSClassWhitelist] as string | undefined;
    let userFlair: UserFlair | undefined;
    if (userFlairCSSClassWhitelist || userFlairCSSClassWhitelist) {
        userFlair = await user.getUserFlairBySubreddit(subredditName);
    }

    if (userFlairWhitelist && userFlair) {
        const whitelistedFlairs = userFlairWhitelist.split(",").map(x => x.toLowerCase().trim());
        if (userFlair.flairText && whitelistedFlairs.includes(userFlair.flairText.toLowerCase())) {
            console.log(`User's flair (${userFlair.flairText} is whitelisted. No action will be taken,`);
            return;
        }
    }

    if (userFlairCSSClassWhitelist && userFlair) {
        const whitelistedFlairCSSClasses = userFlairCSSClassWhitelist.split(",").map(x => x.toLowerCase().trim());
        if (userFlair.flairCssClass && whitelistedFlairCSSClasses.includes(userFlair.flairCssClass.toLowerCase())) {
            console.log(`User's flair CSS class (${userFlair.flairCssClass}) is whitelisted. No action will be taken.`);
            return;
        }
    }

    const banEnabled = settings[AppSetting.BanEnabled] as boolean | undefined ?? true;

    const actions: Promise<void>[] = [];

    if (banEnabled && problematicItemsResult.userBannable) {
        actions.push(banUser(context, subredditName, userName, problematicItemsResult));
    }

    if (!settings[AppSetting.ApplyBanBehavioursToOtherActions] && !problematicItemsResult.userBannable) {
        console.log("Other action options are turned on, but user was previously unbanned. Skipping");
        return;
    }

    let target: Post | Comment | undefined;
    if (targetId) {
        target = await getPostOrCommentById(targetId, context);
    } else {
        // Get the most recent user entry from the subreddit.
        const userContent = await context.reddit.getCommentsAndPostsByUser({
            username: userName,
            sort: "new",
        }).all();

        target = userContent.find(item => item.subredditName === context.subredditName);
    }

    if (!target) {
        return;
    }

    // Perform actions!
    actions.push(
        reportContent(target, problematicItemsResult, settings, context),
        removeContent(target, settings, context),
        replyToContent(target, problematicItemsResult, settings, context),
        sendModmail(target, problematicItemsResult, settings, context),
        addModNote(target, problematicItemsResult, settings, context),
    );
}
