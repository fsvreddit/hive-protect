import { Comment, Post, TriggerContext } from "@devvit/public-api";
import { isCommentId, isLinkId } from "@devvit/public-api/types/tid.js";

export async function isModerator (context: TriggerContext, subredditName: string, username: string): Promise<boolean> {
    if (username === "AutoModerator" || username === `${subredditName}-modTeam`) {
        return true;
    }

    try {
        const filteredModeratorList = await context.reddit.getModerators({ subredditName, username }).all();
        return filteredModeratorList.length > 0;
    } catch {
        // Gated subreddit. Assume not a mod.
        return false;
    }
}

export async function isContributor (context: TriggerContext, subredditName: string, username: string): Promise<boolean> {
    const filteredContributorList = await context.reddit.getApprovedUsers({ subredditName, username }).all();
    return filteredContributorList.length > 0;
}

export async function isBanned (context: TriggerContext, subredditName: string, username: string): Promise<boolean> {
    const bannedUsers = await context.reddit.getBannedUsers({
        subredditName,
        username,
    }).all();

    return bannedUsers.length > 0;
}

export function replaceAll (input: string, pattern: string, replacement: string): string {
    return input.split(pattern).join(replacement);
}

export function trimLeadingWWW (hostname: string): string {
    if (hostname.startsWith("www.")) {
        return hostname.substring(4);
    }
    return hostname;
}

export function domainFromUrlString (url: string): string {
    if (url.startsWith("/r/") || url.startsWith("/u")) {
        return "reddit.com";
    }

    try {
        return trimLeadingWWW(new URL(url).hostname);
    } catch (error) {
        console.log(`Error getting hostname. Input: ${url}`);
        console.log(error);
        return "";
    }
}

export function getPostOrCommentById (thingId: string, context: TriggerContext): Promise<Post | Comment> {
    if (isCommentId(thingId)) {
        return context.reddit.getCommentById(thingId);
    } else if (isLinkId(thingId)) {
        return context.reddit.getPostById(thingId);
    } else {
        throw new Error(`Invalid thingId ${thingId}`);
    }
}
