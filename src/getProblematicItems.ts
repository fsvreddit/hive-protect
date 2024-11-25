import { Comment, GetUserOverviewOptions, Post, TriggerContext, User } from "@devvit/public-api";
import { uniq } from "lodash";
import { AppSetting, PrevBanBehaviour } from "./settings.js";
import { domainFromUrlString, isContributor, isModerator, trimLeadingWWW } from "./utility.js";
import pluralize from "pluralize";
import { isUserBlockingAppAccount } from "./blockChecker.js";
import { addHours, subDays } from "date-fns";
import { queueSecondCheck } from "./secondChecks.js";

export const CACHE_DURATION_HOURS = 12;

export function getLatestResultKey (username: string) {
    return `participation-lastcheck-${username}`;
}

export interface ProblematicSubsResult {
    badSubs: string[];
    badDomains: string[];
    itemPermalink?: string;
    userBannable: boolean;
    userBlocking: boolean;
}

export async function lastCheckResult (context: TriggerContext, userName: string): Promise<ProblematicSubsResult | undefined> {
    const recentCheckValue = await context.redis.get(getLatestResultKey(userName));

    if (!recentCheckValue) {
        return;
    }

    return JSON.parse(recentCheckValue) as ProblematicSubsResult;
}

async function previousBanDate (context: TriggerContext, subredditName: string, userName: string): Promise<Date | undefined> {
    const redisKey = `participation-prevbanned-${userName}`;
    const previousBanDateAsString = await context.redis.get(redisKey);
    if (!previousBanDateAsString) {
        return;
    }

    return new Date(parseInt(previousBanDateAsString));
}

export interface MockSubItem {
    createdAt: Date;
    subredditName: string;
    url: string;
    permalink: string;
}

export interface BadSubItem {
    item: Post | Comment | MockSubItem;
    foundViaSubreddit: boolean;
    foundViaDomain: boolean;
}

export function isOverThreshold (items: BadSubItem[], combinedThreshold: number, postThreshold: number, commentThreshold: number, minSubCount: number): boolean {
    function isOver (items: BadSubItem[], threshold: number, minSubCount: number): boolean {
        if (items.length < threshold) {
            return false;
        }

        const itemsViaDomainCount = items.filter(x => x.foundViaDomain).length;
        const distinctSubCount = uniq(items.filter(item => item.foundViaSubreddit).map(item => item.item.subredditName)).length;

        return itemsViaDomainCount >= threshold || (items.length >= threshold && distinctSubCount >= minSubCount);
    }

    if (combinedThreshold && isOver(items, combinedThreshold, minSubCount)) {
        return true;
    }

    if (postThreshold && isOver(items.filter(item => item.item instanceof Post), postThreshold, minSubCount)) {
        return true;
    }

    if (commentThreshold && isOver(items.filter(item => item.item instanceof Comment), commentThreshold, minSubCount)) {
        return true;
    }

    return false;
}

export interface Domain {
    domain: string;
    wildcard: boolean;
}

export function isDomainInList (domain: string, domainList: Domain[]): boolean {
    return domainList.some(item => domain === item.domain || (item.wildcard && domain.endsWith(`.${item.domain}`)));
}

export async function problematicItemsFound (context: TriggerContext, subredditName: string, userName: string, ignoreCachedResults?: boolean): Promise<ProblematicSubsResult> {
    const emptyResult = {
        badSubs: [],
        badDomains: [],
        userBannable: false,
        userBlocking: false,
    } as ProblematicSubsResult;

    // Shortcut most likely reason for skipping before even retrieving comment or config.
    const lastResult = await lastCheckResult(context, userName);

    if (lastResult && !ignoreCachedResults) {
        return lastResult;
    }

    const settings = await context.settings.getAll();
    const combinedThreshold = settings[AppSetting.CombinedItemCount] as number | undefined ?? 0;
    const postThreshold = settings[AppSetting.PostCount] as number | undefined ?? 0;
    const commentThreshold = settings[AppSetting.CommentCount] as number | undefined ?? 0;
    const minSubCount = settings[AppSetting.NumberOfSubredditsThatMustMatch] as number | undefined ?? 1;

    if (!combinedThreshold && !postThreshold && !commentThreshold) {
        console.log("No thresholds are defined. Quitting.");
        return emptyResult;
    }

    const userWhitelistSetting = settings[AppSetting.UserWhitelist] as string | undefined;
    if (userWhitelistSetting) {
        const whitelistedUsers = userWhitelistSetting.split(",").map(x => x.trim().toLowerCase());
        if (whitelistedUsers.includes(userName.toLowerCase())) {
            console.log("User is whitelisted.");
            return emptyResult;
        }
    }

    // Get main config and quit if not defined properly.
    const subReddits = settings[AppSetting.Subreddits] as string | undefined ?? "";
    const domains = settings[AppSetting.Domains] as string | undefined ?? "";

    // Convert into an array of lower-case individual sub names
    const subredditList = subReddits.toLowerCase().split(",").map(subName => subName.trim()).filter(subName => subName !== "");

    const domainList = domains.toLowerCase().split(",")
        .map(domain => trimLeadingWWW(domain.trim()))
        .filter(domain => domain !== "")
        .map(domain => ({ domain: domain.startsWith("*.") ? domain.replace("*.", "") : domain, wildcard: domain.startsWith("*.") } as Domain));

    if (subredditList.length === 0 && domainList.length === 0) {
        console.log("No subreddits or domains defined.");
        return emptyResult;
    }

    let userContent: (Post | Comment)[] = [];

    const userOverviewOptions = {
        username: userName,
        limit: 100,
        pageSize: 100,
        sort: "new",
    } as GetUserOverviewOptions;

    try {
        if (combinedThreshold || (postThreshold && commentThreshold)) {
            userContent = await context.reddit.getCommentsAndPostsByUser(userOverviewOptions).all();
        } else if (postThreshold) {
            userContent = await context.reddit.getPostsByUser(userOverviewOptions).all();
        } else if (commentThreshold) {
            userContent = await context.reddit.getCommentsByUser(userOverviewOptions).all();
        }
    } catch {
        return emptyResult;
    }

    let badSubItems = userContent
        .filter(item => item.subredditId !== context.subredditId)
        .map(item => ({
            item,
            foundViaSubreddit: subredditList.includes(item.subredditName.toLowerCase()),
            foundViaDomain: isDomainInList(domainFromUrlString(item.url), domainList),
        } as BadSubItem)).filter(item => item.foundViaDomain || item.foundViaSubreddit);

    let hasMatchingSocialLinks = false;
    const matchingSocialLinksDomains: string[] = [];
    if (settings[AppSetting.CheckSocialLinks] && domainList.length > 0) {
        let user: User | undefined;
        try {
            user = await context.reddit.getUserByUsername(userName);
        } catch {
            //
        }

        if (user) {
            const socialLinks = await user.getSocialLinks();
            matchingSocialLinksDomains.push(...socialLinks.filter(link => isDomainInList(domainFromUrlString(link.outboundUrl), domainList)).map(link => domainFromUrlString(link.outboundUrl)));
            hasMatchingSocialLinks = matchingSocialLinksDomains.length > 0;
        }
    }

    let failsChecks: boolean | undefined;
    let userBannable = false;

    if (badSubItems.length > 0 || hasMatchingSocialLinks) {
        // Filter down further to check the configured thresholds.
        const daysToMonitor = settings[AppSetting.DaysToMonitor] as number | undefined ?? 28;
        badSubItems = badSubItems.filter(item => item.item.createdAt > subDays(new Date(), daysToMonitor));
        failsChecks = hasMatchingSocialLinks || isOverThreshold(badSubItems, combinedThreshold, postThreshold, commentThreshold, minSubCount);

        if (failsChecks) {
            // Over threshold, but user may have been previously banned.
            console.log("User is over the ban threshold. Checking for previous bans.");
            const previousBan = await previousBanDate(context, subredditName, userName);
            if (previousBan) {
                console.log(`User was previously banned at ${previousBan.toISOString()}`);
                const postBanBehaviour = (settings[AppSetting.BehaviourIfPrevBan] as string[] | undefined ?? [PrevBanBehaviour.NeverReBan])[0] as PrevBanBehaviour;

                switch (postBanBehaviour) {
                    case PrevBanBehaviour.NeverReBan:
                        console.log("App is configured to never re-ban.");
                        userBannable = false;
                        break;
                    case PrevBanBehaviour.OnlyRebanIfNewContent:
                        console.log("App is configured to only ban based on content since last ban. Disregarding previous content.");
                        badSubItems = badSubItems.filter(item => item.item.createdAt > previousBan);
                        failsChecks = failsChecks === hasMatchingSocialLinks || isOverThreshold(badSubItems, combinedThreshold, postThreshold, commentThreshold, minSubCount);
                        userBannable = failsChecks;
                        break;
                    case PrevBanBehaviour.AlwaysReBan:
                        console.log("App is configured to always re-ban.");
                        userBannable = true;
                        break;
                }
            } else {
                userBannable = true;
            }
        }
    } else {
        failsChecks = false;
    }

    const badPostCount = badSubItems.filter(item => item.item instanceof Post).length;
    const badCommentCount = badSubItems.filter(item => item.item instanceof Comment).length;
    const badDomainCount = matchingSocialLinksDomains.length;

    if (badPostCount || badCommentCount || badDomainCount) {
        console.log(`Found ${badPostCount} ${pluralize("post", badPostCount)}, ${badCommentCount} ${pluralize("comment", badCommentCount)} and ${badDomainCount} ${pluralize("domain", badDomainCount)} of concern for ${userName}. Over threshold: ${JSON.stringify(failsChecks)}`);
    }

    if (failsChecks) {
        // Now check if user is a mod, approved or previously banned. These are generally unlikely to be
        // true for most subs, so we only do these checks if the user was going to be banned otherwise.
        const skipChecksPromises: Promise<boolean>[] = [isModerator(context, subredditName, userName)];
        if (settings[AppSetting.ExemptApprovedUser]) {
            skipChecksPromises.push(isContributor(context, subredditName, userName));
        }

        const reasonsToSkipChecks = await Promise.all(skipChecksPromises);

        // If any check returns "True", user isn't eligible to be checked.
        if (reasonsToSkipChecks.includes(true)) {
            console.log(`User ${userName} is not due a ban (mod or approved)`);
            failsChecks = false;
        }
    }

    let result: ProblematicSubsResult;
    if (failsChecks) {
        result = {
            badSubs: uniq(badSubItems.filter(item => item.foundViaSubreddit).map(item => item.item.subredditName)),
            badDomains: uniq([...matchingSocialLinksDomains, ...badSubItems.filter(item => item.foundViaDomain).map(item => domainFromUrlString(item.item.url))]),
            itemPermalink: badSubItems[0]?.item.permalink,
            userBannable,
            userBlocking: false,
        } as ProblematicSubsResult;
    } else {
        if (settings[AppSetting.AntiBlockCheckerEnable]) {
            const isBlocking = await isUserBlockingAppAccount(userContent, context);
            if (isBlocking) {
                console.log(`User ${userName} may be blocking Hive Protector!`);
                result = {
                    badDomains: [],
                    badSubs: [],
                    userBannable: false,
                    userBlocking: true,
                } as ProblematicSubsResult;
            } else {
                result = emptyResult;
            }
        } else {
            result = emptyResult;
        }

        const secondCheckInterval = settings[AppSetting.SecondCheckInterval] as number | undefined;
        if (secondCheckInterval) {
            await queueSecondCheck(userName, secondCheckInterval, context);
        }
    }

    // Store record of this result. Cache for 1 hour if a positive result, or 12 hours if negative.
    let cacheExpiryTime: Date;
    if (result.badSubs.length > 0 || result.badDomains.length > 0) {
        cacheExpiryTime = addHours(new Date(), 1);
    } else {
        cacheExpiryTime = addHours(new Date(), CACHE_DURATION_HOURS);
    }
    await context.redis.set(getLatestResultKey(userName), JSON.stringify(result), { expiration: cacheExpiryTime });

    return result;
}
