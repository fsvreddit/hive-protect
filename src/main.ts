import { Devvit } from "@devvit/public-api";
import { handleCommentSubmitEvent, handlePostSubmitEvent, processUserCheckQueue } from "./handleContentCreation.js";
import { appSettings } from "./settings.js";
import { handleAppInstallEvent, handleAppUpgradeEvent } from "./installEventHandlers.js";
import { cleanupDeletedAccounts } from "./cleanupTasks.js";
import { SchedulerJob } from "./constants.js";
import { handleModActionEvent } from "./handleModActions.js";
import { handleUserExemptMenu } from "./exemptUserFeature.js";
import { handleV2UpdateNotifierJob } from "./v2UpdateNotifier.js";
import { sendDailyDigest } from "./sendDailyDigest.js";

Devvit.addSettings(appSettings);

Devvit.addMenuItem({
    label: "Toggle Hive Protector user exemption status",
    location: "post",
    forUserType: "moderator",
    onPress: handleUserExemptMenu,
});

Devvit.addMenuItem({
    label: "Toggle Hive Protector user exemption status",
    location: "comment",
    forUserType: "moderator",
    onPress: handleUserExemptMenu,
});

Devvit.addTrigger({
    event: "PostSubmit",
    onEvent: handlePostSubmitEvent,
});

Devvit.addTrigger({
    event: "CommentSubmit",
    onEvent: handleCommentSubmitEvent,
});

Devvit.addTrigger({
    event: "ModAction",
    onEvent: handleModActionEvent,
});

Devvit.addTrigger({
    event: "AppInstall",
    onEvent: handleAppInstallEvent,
});

Devvit.addTrigger({
    event: "AppUpgrade",
    onEvent: handleAppUpgradeEvent,
});

Devvit.addSchedulerJob({
    name: SchedulerJob.CleanupDeletedAccounts,
    onRun: cleanupDeletedAccounts,
});

Devvit.addSchedulerJob({
    name: SchedulerJob.CheckUserQueue,
    onRun: processUserCheckQueue,
});

Devvit.addSchedulerJob({
    name: SchedulerJob.DailyDigest,
    onRun: sendDailyDigest,
});

Devvit.addSchedulerJob({
    name: SchedulerJob.V2UpdateNotifier,
    onRun: handleV2UpdateNotifierJob,
});

Devvit.configure({
    redditAPI: true,
    redis: true,
    http: {
        domains: ["hooks.slack.com", "discord.com", "discordapp.com"],
        enabled: true,
    },
});

export default Devvit;
