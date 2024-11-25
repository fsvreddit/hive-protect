import { Devvit } from "@devvit/public-api";
import { handleCommentSubmitEvent, handleModActionEvent, handlePostSubmitEvent } from "./hiveProtect.js";
import { appSettings } from "./settings.js";
import { handleAppInstallOrUpgradeEvent } from "./installEventHandlers.js";
import { cleanupDeletedAccounts } from "./cleanupTasks.js";
import { CLEANUP_JOB, SECOND_CHECK_JOB } from "./constants.js";
import { handleSecondCheckJob } from "./secondChecks.js";

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

Devvit.addSchedulerJob({
    name: SECOND_CHECK_JOB,
    onRun: handleSecondCheckJob,
});

Devvit.configure({
    redditAPI: true,
    redis: true,
});

export default Devvit;
