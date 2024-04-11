import {Devvit} from "@devvit/public-api";
import {handleCommentSubmitEvent, handleModAction, handlePostSubmitEvent} from "./hiveProtect.js";
import {appSettings} from "./settings.js";
import {onAppUpgrade} from "./installEventHandlers.js";

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
    onEvent: handleModAction,
});

Devvit.addTrigger({
    event: "AppUpgrade",
    onEvent: onAppUpgrade,
});

Devvit.configure({
    redditAPI: true,
    redis: true,
});

export default Devvit;
