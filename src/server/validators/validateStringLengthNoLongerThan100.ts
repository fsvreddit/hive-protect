import { SettingsValidationRequest, SettingsValidationResponse } from "@devvit/web/shared";
import type { Context } from "hono";

export const handleStringNoLongerThan100 = async (c: Context): Promise<Response> => {
    const { value } = await c.req.json<SettingsValidationRequest<string>>();

    if (value !== undefined && value.length > 100) {
        return c.json<SettingsValidationResponse>({
            success: false,
            error: "Value must be no longer than 100 characters",
        }, 200);
    }

    return c.json<SettingsValidationResponse>({ success: true }, 200);
};
