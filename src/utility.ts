import { Comment, Post, TriggerContext } from "@devvit/public-api";
import { isCommentId, isLinkId } from "@devvit/public-api/types/tid.js";

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
