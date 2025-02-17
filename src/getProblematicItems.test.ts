import { BadSubItem, Domain, isDomainInList, isOverThreshold, MockSubItem } from "./getProblematicItems.js";

test("Exact domain", () => {
    const input = "bbc.co.uk";
    const domains: Domain[] = [
        { domain: "bbc.co.uk", wildcard: false },
        { domain: "theguardian.com", wildcard: false },
    ];

    expect(isDomainInList(input, domains)).toBeTruthy();
});

test("Domain not in list", () => {
    const input = "thetimes.co.uk";
    const domains: Domain[] = [
        { domain: "bbc.co.uk", wildcard: false },
        { domain: "theguardian.com", wildcard: false },
    ];

    expect(isDomainInList(input, domains)).toBeFalsy();
});

test("Wildcarded domain matched", () => {
    const input = "lucid.substack.com";
    const domains: Domain[] = [
        { domain: "bbc.co.uk", wildcard: false },
        { domain: "substack.com", wildcard: true },
    ];

    expect(isDomainInList(input, domains)).toBeTruthy();
});

test("Wildcarded domain matched without subdomain", () => {
    const input = "substack.com";
    const domains: Domain[] = [
        { domain: "bbc.co.uk", wildcard: false },
        { domain: "substack.com", wildcard: true },
    ];

    expect(isDomainInList(input, domains)).toBeTruthy();
});

test("Wildcarded domain shouldn't match fake domains", () => {
    const input = "notthebbc.co.uk";
    const domains: Domain[] = [
        { domain: "bbc.co.uk", wildcard: true },
    ];

    expect(isDomainInList(input, domains)).toBeFalsy();
});

test("Subdomain not in list", () => {
    const input = "lucid.substack.com";
    const domains: Domain[] = [
        { domain: "bbc.co.uk", wildcard: false },
        { domain: "substack.com", wildcard: false },
    ];

    expect(isDomainInList(input, domains)).toBeFalsy();
});

test("Multi-subreddit matches", () => {
    const input: BadSubItem[] = [
        {
            item: {
                createdAt: new Date(),
                permalink: "",
                url: "",
                subredditName: "FreeKarma4U",
            } as MockSubItem,
            foundViaSubreddit: true,
            foundViaDomain: false,
        },
        {
            item: {
                createdAt: new Date(),
                permalink: "",
                url: "",
                subredditName: "FreeKarmaForYou",
            } as MockSubItem,
            foundViaSubreddit: true,
            foundViaDomain: false,
        },
    ];

    const expected = [false, true, true, false];
    const actual = [
        isOverThreshold(input, 3, 0, 0, 1),
        isOverThreshold(input, 2, 0, 0, 1),
        isOverThreshold(input, 2, 0, 0, 2),
        isOverThreshold(input, 2, 0, 0, 3),
    ];

    expect(actual).toEqual(expected);
});

test("Multi-subreddit matches with domains", () => {
    const input: BadSubItem[] = [
        {
            item: {
                createdAt: new Date(),
                permalink: "",
                url: "",
                subredditName: "FreeKarma4U",
            } as MockSubItem,
            foundViaSubreddit: false,
            foundViaDomain: true,
        },
        {
            item: {
                createdAt: new Date(),
                permalink: "",
                url: "",
                subredditName: "FreeKarmaForYou",
            } as MockSubItem,
            foundViaSubreddit: true,
            foundViaDomain: false,
        },
        {
            item: {
                createdAt: new Date(),
                permalink: "",
                url: "",
                subredditName: "FreeKarmaForYou",
            } as MockSubItem,
            foundViaSubreddit: true,
            foundViaDomain: false,
        },
    ];

    const expected = [false, false, true, true, false];
    const actual = [
        isOverThreshold(input, 4, 0, 0, 2),
        isOverThreshold(input, 3, 0, 0, 2),
        isOverThreshold(input, 2, 0, 0, 1),
        isOverThreshold(input, 1, 0, 0, 2),
        isOverThreshold(input, 2, 0, 0, 3),
    ];

    expect(actual).toEqual(expected);
});

test("Domains only", () => {
    const input: BadSubItem[] = [
        {
            item: {
                createdAt: new Date(),
                permalink: "",
                url: "",
                subredditName: "AskReddit",
            } as MockSubItem,
            foundViaSubreddit: false,
            foundViaDomain: true,
        },
        {
            item: {
                createdAt: new Date(),
                permalink: "",
                url: "",
                subredditName: "AskReddit",
            } as MockSubItem,
            foundViaSubreddit: false,
            foundViaDomain: true,
        },
        {
            item: {
                createdAt: new Date(),
                permalink: "",
                url: "",
                subredditName: "AskReddit",
            } as MockSubItem,
            foundViaSubreddit: false,
            foundViaDomain: true,
        },
    ];

    const expected = [true, true, false, false];
    const actual = [
        isOverThreshold(input, 2, 0, 0, 1),
        isOverThreshold(input, 2, 0, 0, 2),
        isOverThreshold(input, 4, 0, 0, 1),
        isOverThreshold(input, 4, 0, 0, 2),
    ];

    expect(actual).toEqual(expected);
});
