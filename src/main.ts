import {Devvit, TriggerContext, Post, Comment} from "@devvit/public-api";
import {addDays, addHours} from "date-fns";

Devvit.addSettings([
    {
        type: "boolean",
        name: "enabled",
        label: "Enable app",
    },
    {
        type: "paragraph",
        name: "subreddits",
        label: "Enter a comma-separated list of subreddits to watch e.g. freekarma4u,freekarma4all",
    },
    {
        type: "number",
        name: "itemcount",
        label: "Number of posts and comments to meet threshold",
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
        onValidate: async ({value}) => {
            if (!value || value < 1) {
                return "Days to monitor must be at least 1";
            }
        },
    },
    {
        type: "paragraph",
        name: "banmessage",
        label: "Enter a ban reason to send to users",
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
    },
]);

async function userFailsChecks (context: TriggerContext, userName: string): Promise<boolean> {
    const hiveProtectEnabled = await context.settings.get<boolean>("enabled");
    if (!hiveProtectEnabled) {
        console.log("Hive Protector not enabled, quitting");
        return false;
    }

    // Get main config and quit if not defined properly.
    const subReddits = await context.settings.get<string>("subreddits");
    if (!subReddits) {
        console.log("Subreddit list not defined.");
        return false;
    }

    // Convert into an array of lower-case individual sub names
    const subredditList = subReddits.toLowerCase().split(",").map(subName => subName.trim());

    const threshold = await context.settings.get<number>("itemcount");
    const daysToMonitor = await context.settings.get<number>("daystomonitor");
    if (!threshold || !daysToMonitor) {
        console.log("Threshold or Days to Monitor not defined");
        return false;
    }

    const subreddit = await context.reddit.getSubredditById(context.subredditId);

    // Is user a moderator?
    const modCheck = await subreddit.getModerators({
        username: userName,
    }).all();

    if (modCheck.length > 0) {
        console.log(`${userName} is a moderator of /r/${subreddit.name}, quitting`);
        return false;
    }

    // Is user an approved user?
    const exemptApprovedUsers = await context.settings.get<boolean>("exemptapproveduser");
    if (exemptApprovedUsers) {
        const approvedCheck = await subreddit.getApprovedUsers({
            username: userName,
        }).all();

        if (approvedCheck.length > 0) {
            console.log(`${userName} is an approved user of /r/${subreddit.name}, quitting`);
            return false;
        }
    }

    const lastCheckDate = await context.kvStore.get<number>(`participation-lastcheck-${userName}`);
    if (lastCheckDate) {
        if (new Date(lastCheckDate) > addHours(new Date(), -1)) {
            console.log(`Last check on ${userName} was within the last hour, quitting`);
            return false;
        }
    } else {
        console.log(`Have never checked ${userName}.`);
    }

    const wasPreviouslyBanned = await context.kvStore.get<boolean>(`participation-prevbanned-${userName}`);
    if (wasPreviouslyBanned) {
        console.log(`User ${userName} was previously banned, quitting`);
        return false;
    }

    const userContent = await context.reddit.getCommentsAndPostsByUser({
        username: userName,
        limit: 100,
        pageSize: 100,
        sort: "new",
    }).all();

    const badSubItems = userContent.filter(item => subredditList.includes(item.subredditName.toLowerCase())
        && item.createdAt > addDays(new Date(), -daysToMonitor));

    console.log(`Found ${badSubItems.length} item(s) of content in monitored subreddits`);

    // Store record of last time checked
    await context.kvStore.put(`participation-lastcheck-${userName}`, new Date().getTime());

    return badSubItems.length >= threshold;
}

async function banUser (context: TriggerContext, userName: string, subName: string): Promise<void> {
    const banMessage = await context.settings.get<string>("banmessage");
    const banNote = await context.settings.get<string>("bannote");

    let banReason: string;
    if (banNote && banNote.length > 0) {
        banReason = `Hive Protector: ${banNote}`;
    } else {
        banReason = "Banned by Hive Protector";
    }

    await context.reddit.banUser({
        username: userName,
        reason: banReason,
        message: banMessage,
        subredditName: subName,
    });

    console.log(`Banned ${userName} from ${subName}`);
}

async function processEvent (item: Post | Comment, context: TriggerContext): Promise<void> {
    const userName = item.authorName;

    const shouldBan = await userFailsChecks(context, userName);

    if (!shouldBan) {
        return;
    }

    await banUser(context, userName, item.subredditName);

    await context.kvStore.put(`participation-prevbanned-${userName}`, true);

    await item.remove(true);
    console.log(`Removed item ${item.id}`);
}

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
