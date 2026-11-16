import { redis } from "@devvit/web/server";

export function getUserExemptionKey (username: string): string {
    return `userExempt:${username}`;
}

export async function userIsExemptByMenu (username: string): Promise<boolean> {
    const existsVal = await redis.exists(getUserExemptionKey(username));
    return existsVal === 1;
}
