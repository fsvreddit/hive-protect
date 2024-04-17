import {Devvit} from "@devvit/public-api";
import {handleCommentSubmitEvent, handleModActionEvent, handlePostSubmitEvent} from "./hiveProtect.js";
import {appSettings} from "./settings.js";
import {handleAppUpgradeEvent} from "./installEventHandlers.js";

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
    event: "AppUpgrade",
    onEvent: handleAppUpgradeEvent,
});

Devvit.configure({
    redditAPI: true,
    redis: true,
});

export default Devvit;
