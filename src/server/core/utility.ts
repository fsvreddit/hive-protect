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
