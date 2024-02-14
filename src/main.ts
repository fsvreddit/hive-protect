import {Devvit} from "@devvit/public-api";
import {handlePostOrCommentSubmitEvent} from "./hiveProtect.js";
import {appSettings} from "./settings.js";

Devvit.addSettings(appSettings);

Devvit.addTrigger({
    events: ["PostSubmit", "CommentSubmit"],
    onEvent: handlePostOrCommentSubmitEvent,
});

Devvit.configure({
    redditAPI: true,
    redis: true,
});

export default Devvit;
