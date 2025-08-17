import { Devvit } from "@devvit/public-api";
import { handleCommentSubmitEvent, handlePostSubmitEvent } from "./handleContentCreation.js";
import { appSettings } from "./settings.js";
import { handleAppInstallOrUpgradeEvent } from "./installEventHandlers.js";
import { cleanupDeletedAccounts } from "./cleanupTasks.js";
import { CLEANUP_JOB } from "./constants.js";
import { handleModActionEvent } from "./handleModActions.js";

Devvit.addSettings(appSettings);

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
    events: ["AppInstall", "AppUpgrade"],
    onEvent: handleAppInstallOrUpgradeEvent,
});

Devvit.addSchedulerJob({
    name: CLEANUP_JOB,
    onRun: cleanupDeletedAccounts,
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
