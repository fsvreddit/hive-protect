import { SettingsValidationRequest, SettingsValidationResponse } from "@devvit/web/shared";
import type { Context } from "hono";
import { trimLeadingWWW } from "../core";

export const handleValidateDomains = async (c: Context): Promise<Response> => {
    const { value } = await c.req.json<SettingsValidationRequest<string>>();

    if (value && value.length > 0) {
        const items = value.toLowerCase().split(",")
            .map(domain => trimLeadingWWW(domain.trim()))
            .filter(domain => domain !== "");

        const disallowed = ["reddit.com", "redd.it"];

        const badItems = items.filter(x => disallowed.includes(x) || disallowed.some(item => x.endsWith(`.${item}`)) || !x.includes("."));

        if (badItems.length > 0) {
            return c.json<SettingsValidationResponse>({
                success: false,
                error: `Invalid domains in list: ${badItems.join(", ")}`,
            });
        }
    }

    return c.json<SettingsValidationResponse>({ success: true }, 200);
};
