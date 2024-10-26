import { Devvit } from "@devvit/public-api";
import { handleCommentSubmitEvent, handleModActionEvent, handlePostSubmitEvent } from "./hiveProtect.js";
import { appSettings } from "./settings.js";
import { handleAppInstallOrUpgradeEvent } from "./installEventHandlers.js";
import { cleanupDeletedAccounts } from "./cleanupTasks.js";

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
    name: "cleanupDeletedAccounts",
    onRun: cleanupDeletedAccounts,
});

Devvit.configure({
    redditAPI: true,
    redis: true,
});

export default Devvit;
