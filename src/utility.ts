import {TriggerContext} from "@devvit/public-api";

export async function isModerator (context: TriggerContext, subredditName: string, username: string): Promise<boolean> {
    const filteredModeratorList = await context.reddit.getModerators({subredditName, username}).all();
    return filteredModeratorList.length > 0;
}

export async function isContributor (context: TriggerContext, subredditName: string, username: string): Promise<boolean> {
    const filteredContributorList = await context.reddit.getApprovedUsers({subredditName, username}).all();
    return filteredContributorList.length > 0;
}

export async function getSubredditName (context: TriggerContext) {
    // Prevent needless calls to Reddit API by using a read-through cache.
    const redisKey = "subredditName";
    const subredditName = await context.redis.get(redisKey);
    if (subredditName) {
        return subredditName;
    }

    const subreddit = await context.reddit.getCurrentSubreddit();
    await context.redis.set(redisKey, subreddit.name);
    return subreddit.name;
}

export async function getAppName (context: TriggerContext) {
    // Prevent needless calls to Reddit API by using a read-through cache.
    const redisKey = "appName";
    const appName = await context.redis.get(redisKey);
    if (appName) {
        return appName;
    }

    const appUser = await context.reddit.getCurrentUser();
    await context.redis.set(redisKey, appUser.username);
    return appUser.username;
}
