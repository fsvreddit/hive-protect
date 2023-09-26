import {Devvit, TriggerContext, Post, Comment} from "@devvit/public-api";
import {addDays, addHours} from "date-fns";
import {isModerator, isContributor} from "devvit-helpers";

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

async function userApproved (context: TriggerContext, subName: string, userName: string): Promise<boolean> {
    const exemptApprovedUsers = await context.settings.get<boolean>("exemptapproveduser");
    if (exemptApprovedUsers) {
        return isContributor(context.reddit, subName, userName);
    } else {
        return false;
    }
}

async function lastCheckTooRecent (context: TriggerContext, userName: string): Promise<boolean> {
    const lastCheckDate = await context.kvStore.get<number>(`participation-lastcheck-${userName}`);
    if (lastCheckDate) {
        return new Date(lastCheckDate) > addHours(new Date(), -1);
    } else {
        return false;
    }
}

async function userWasPreviouslyBanned (context: TriggerContext, userName: string): Promise<boolean> {
    const wasPreviouslyBanned = await context.kvStore.get<boolean>(`participation-prevbanned-${userName}`);
    return wasPreviouslyBanned ?? false;
}

async function userFailsChecks (context: TriggerContext, subName: string, userName: string): Promise<boolean> {
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

    const reasonsToSkipChecks = await Promise.all([
        isModerator(context.reddit, subName, userName),
        userApproved(context, subName, userName),
        lastCheckTooRecent(context, userName),
        userWasPreviouslyBanned(context, userName),
    ]);

    // If any check returns "True", user isn't eligible to be checked.
    if (reasonsToSkipChecks.includes(true)) {
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
    if (banNote) {
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

    const shouldBan = await userFailsChecks(context, item.subredditName, userName);

    if (!shouldBan) {
        return;
    }

    await Promise.all([
        banUser(context, userName, item.subredditName),
        context.kvStore.put(`participation-prevbanned-${userName}`, true),
        item.remove(true),
    ]);

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
