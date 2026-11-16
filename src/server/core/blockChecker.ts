import { Comment, context, Post, redis } from "@devvit/web/server";
import { addDays, subMonths } from "date-fns";
import { isModerator } from "@fsvreddit/fsv-devvit-web-helpers";
import { uniq } from "lodash";

async function appUserIsModOfSub (subredditName: string): Promise<boolean> {
    const redisKey = `appUserIsModOfSub~${subredditName}`;
    const cachedValue = await redis.get(redisKey);
    if (cachedValue) {
        return JSON.parse(cachedValue) as boolean;
    }

    const isMod = await isModerator(subredditName, context.appSlug);
    console.log(`App account mod of ${subredditName}? ${isMod}`);

    await redis.set(redisKey, JSON.stringify(isMod), { expiration: addDays(new Date(), 7) });
    return isMod;
}

export async function isUserBlockingAppAccount (userHistory: (Post | Comment)[]): Promise<boolean> {
    if (userHistory.length < 20) {
        // Immature account, may not have accrued enough history to be reasonably confident about blocking.
        return false;
    }

    const subreddits = uniq(userHistory.filter(x => x.subredditId !== context.subredditId).map(x => x.subredditName));
    if (subreddits.length === 0) {
        return false;
    }

    for (const subreddit of subreddits) {
        const isModOfSub = await appUserIsModOfSub(subreddit);
        if (!isModOfSub) {
            return false;
        }
    }

    if (subreddits.length < 3) {
        // Too few subreddits to determine if they may be blocking.
        return false;
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const user = await userHistory[0]!.getAuthor();
    if (user) {
        if (user.createdAt > subMonths(new Date(), 1)) {
            // Immature account, may not have accrued enough history to be reasonably confident about blocking.
            return false;
        }
    }

    return true;
}
