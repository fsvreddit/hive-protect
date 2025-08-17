import { TriggerContext, User, UserFlair } from "@devvit/public-api";
import { ProblematicSubsResult } from "./getProblematicItems.js";
import { getPostOrCommentById } from "./utility.js";
import { AppSetting } from "./settings.js";
import { subDays } from "date-fns";
import { ALL_ACTIONS } from "./actions/_AllActions.js";
import { userIsExemptByMenu } from "./exemptUserFeature.js";

export async function actionUser (userName: string, targetId: string, problematicItemsResult: ProblematicSubsResult, context: TriggerContext) {
    const settings = await context.settings.getAll();

    let user: User | undefined;
    try {
        user = await context.reddit.getUserByUsername(userName);
    } catch {
        //
    }

    if (!user) {
        console.log("User object is not defined. This could indicate a shadowbanned user.");
        return;
    }

    if (user.isAdmin) {
        console.log(`${userName} is an admin! No action will be taken.`);
        return;
    }

    if (await userIsExemptByMenu(userName, context)) {
        console.log(`User ${userName} is exempt from actions.`);
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

    const exemptAccountOlderThanDays = settings[AppSetting.ExemptAccountOlderThanDays] as number | undefined;
    if (exemptAccountOlderThanDays && user.createdAt < subDays(new Date(), exemptAccountOlderThanDays)) {
        console.log(`User is exempt from checks because account is older than ${exemptAccountOlderThanDays} days.`);
        return;
    }

    const exemptAccountWithThisLinkKarma = settings[AppSetting.ExemptAccountWithThisLinkKarma] as number | undefined;
    if (exemptAccountWithThisLinkKarma && user.linkKarma > exemptAccountWithThisLinkKarma) {
        console.log(`User is exempt from checks because link karma is greater than ${exemptAccountWithThisLinkKarma}.`);
        return;
    }

    const exemptAccountWithThisCommentKarma = settings[AppSetting.ExemptAccountWithThisCommentKarma] as number | undefined;
    if (exemptAccountWithThisCommentKarma && user.commentKarma > exemptAccountWithThisCommentKarma) {
        console.log(`User is exempt from checks because comment karma is greater than ${exemptAccountWithThisCommentKarma}.`);
        return;
    }

    const target = await getPostOrCommentById(targetId, context);

    const actions: Promise<void>[] = [];

    for (const Action of ALL_ACTIONS) {
        const actionInstance = new Action(target, problematicItemsResult, settings, context);
        if (actionInstance.isModuleEnabled()) {
            actions.push(actionInstance.execute());
        }
    }

    await Promise.all(actions);
}
