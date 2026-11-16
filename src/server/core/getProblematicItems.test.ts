import { vi } from "vitest";

vi.hoisted(() => {
    // @ts-expect-error config stub for tests
    globalThis.devvit = { config: {} };
});

vi.mock("@devvit/web/server", () => ({
    context: {
        subredditId: "t5_test",
        subredditName: "BotBouncer",
    },
    redis: {},
}));

vi.mock("@fsvreddit/fsv-devvit-web-helpers", () => ({
    getExtendedDevvit: vi.fn(),
    hasEventBeenHandled: vi.fn(),
}));

import { BadSubItem, Domain, getMatchingUrlAndDomain, isDomainInList, isOverThreshold } from "./getProblematicItems.js";

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
                id: "t1_123",
                createdAt: new Date(),
                score: 10,
                permalink: "",
                url: "",
                subredditName: "FreeKarma4U",
            },
            foundViaSubreddit: true,
            foundViaDomain: false,
        },
        {
            item: {
                id: "t1_124",
                createdAt: new Date(),
                score: 10,
                permalink: "",
                url: "",
                subredditName: "FreeKarmaForYou",
            },
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
                id: "t1_125",
                createdAt: new Date(),
                score: 10,
                permalink: "",
                url: "",
                subredditName: "FreeKarma4U",
            },
            foundViaSubreddit: false,
            foundViaDomain: true,
        },
        {
            item: {
                id: "t1_126",
                createdAt: new Date(),
                score: 10,
                permalink: "",
                url: "",
                subredditName: "FreeKarmaForYou",
            },
            foundViaSubreddit: true,
            foundViaDomain: false,
        },
        {
            item: {
                id: "t1_127",
                createdAt: new Date(),
                score: 10,
                permalink: "",
                url: "",
                subredditName: "FreeKarmaForYou",
            },
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
                id: "t1_128",
                createdAt: new Date(),
                permalink: "",
                url: "",
                subredditName: "AskReddit",
                score: 10,
            },
            foundViaSubreddit: false,
            foundViaDomain: true,
        },
        {
            item: {
                id: "t1_129",
                createdAt: new Date(),
                permalink: "",
                url: "",
                subredditName: "AskReddit",
                score: 10,
            },
            foundViaSubreddit: false,
            foundViaDomain: true,
        },
        {
            item: {
                id: "t1_130",
                createdAt: new Date(),
                permalink: "",
                url: "",
                subredditName: "AskReddit",
                score: 10,
            },
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

test("No matches in user bio", () => {
    const userBio = "I love posting on Reddit!";
    const domain = { domain: "example.com", wildcard: false } as Domain;
    const result = getMatchingUrlAndDomain(userBio, domain);
    expect(result).toBeUndefined();
});

test("Matching URL and domain in user bio", () => {
    const userBio = "Check out my website at https://example.com for more info!";
    const domain = { domain: "example.com", wildcard: false } as Domain;
    const result = getMatchingUrlAndDomain(userBio, domain);
    expect(result).toEqual({ matchedUrl: "https://example.com", matchedDomain: "example.com" });
});

test("Matching URL and domain in user bio with www", () => {
    const userBio = "Check out my website at https://www.example.com for more info!";
    const domain = { domain: "example.com", wildcard: false } as Domain;
    const result = getMatchingUrlAndDomain(userBio, domain);
    expect(result).toEqual({ matchedUrl: "https://www.example.com", matchedDomain: "example.com" });
});

test("Matching URL with subdomain in user bio", () => {
    const userBio = "Visit my blog at https://blog.example.com!";
    const domain = { domain: "example.com", wildcard: true } as Domain;
    const result = getMatchingUrlAndDomain(userBio, domain);
    expect(result).toEqual({ matchedUrl: "https://blog.example.com", matchedDomain: "example.com" });
});

test("URL in user bio that doesn't match domain", () => {
    const userBio = "Check out my website at https://notexample.com!";
    const domain = { domain: "example.com", wildcard: false } as Domain;
    const result = getMatchingUrlAndDomain(userBio, domain);
    expect(result).toBeUndefined();
});

test("URL in user bio that is a substring of a detected domain but not complete match", () => {
    const userBio = "Check out my website at https://example.com.fakeurl.com!";
    const domain = { domain: "example.com", wildcard: false } as Domain;
    const result = getMatchingUrlAndDomain(userBio, domain);
    expect(result).toBeUndefined();
});

test("URL in user bio that matches and has a local part", () => {
    const userBio = "Check out my website at https://example.com/localpart!";
    const domain = { domain: "example.com", wildcard: false } as Domain;
    const result = getMatchingUrlAndDomain(userBio, domain);
    expect(result).toEqual({ matchedUrl: "https://example.com/localpart", matchedDomain: "example.com" });
});
