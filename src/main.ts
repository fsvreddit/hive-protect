import {Devvit} from "@devvit/public-api";
import {processEvent} from "./hiveProtect.js";

Devvit.addSettings([
    {
        type: "paragraph",
        name: "subreddits",
        label: "Enter a comma-separated list of subreddits to watch e.g. freekarma4u,freekarma4all",
    },
    {
        type: "number",
        name: "itemcount",
        label: "Number of posts and comments to meet threshold",
        helpText: "User must have at least this many posts/comments in 'bad' subreddits to result in a removal/ban",
        onValidate: async ({value}) => {
            if (!value || value < 1) {
                return "Threshold must be at least 1";
            }
        },
    },
    {
        type: "number",
        name: "daystomonitor",
        label: "Number of days to monitor",
        helpText: "Only comments within this number of days will be counted",
        onValidate: async ({value}) => {
            if (!value || value < 1) {
                return "Days to monitor must be at least 1";
            }
        },
    },
    {
        type: "paragraph",
        name: "banmessage",
        label: "Enter a ban message to send to users",
    },
    {
        type: "string",
        name: "bannote",
        label: "Enter a note to put in the ban log (optional)",
    },
    {
        type: "boolean",
        name: "exemptapproveduser",
        label: "Exempt approved users",
        helpText: "If this option is selected, approved users will not be checked.",
    },
]);

Devvit.addTrigger({
    event: "PostSubmit",
    async onEvent (event, context) {
        if (!event.post) {
            console.log("A new post was created, but is undefined");
            return;
        }

        const post = await context.reddit.getPostById(event.post.id);

        await processEvent(post, context);
    },
});

Devvit.addTrigger({
    event: "CommentSubmit",
    async onEvent (event, context) {
        if (!event.comment) {
            console.log("A new comment was created, but is undefined");
            return;
        }

        const comment = await context.reddit.getCommentById(event.comment.id);

        await processEvent(comment, context);
    },
});

Devvit.configure({
    redditAPI: true,
    kvStore: true,
});

export default Devvit;
