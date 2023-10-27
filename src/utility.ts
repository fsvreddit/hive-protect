import {TriggerContext} from "@devvit/public-api";

export async function isModerator (context: TriggerContext, subredditName: string, username: string): Promise<boolean> {
    const filteredModeratorList = await context.reddit.getModerators({subredditName, username}).all();
    return filteredModeratorList.length > 0;
}

export async function isContributor (context: TriggerContext, subredditName: string, username: string): Promise<boolean> {
    const filteredContributorList = await context.reddit.getApprovedUsers({subredditName, username}).all();
    return filteredContributorList.length > 0;
}
