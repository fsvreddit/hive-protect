import { BadSubItem, Domain, getMatchingUrlAndDomain, isDomainInList, isOverThreshold, MockSubItem } from "./getProblematicItems.js";

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
                score: 10,
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
                score: 10,
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
                score: 10,
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
                score: 10,
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
                score: 10,
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
                score: 10,
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
                score: 10,
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
                score: 10,
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
