import { SettingsValidationRequest, SettingsValidationResponse } from "@devvit/web/shared";
import type { Context } from "hono";

export const handleValidateNumberGreaterThanZero = async (c: Context): Promise<Response> => {
    const { value } = await c.req.json<SettingsValidationRequest<number>>();

    return c.json<SettingsValidationResponse>(validateNumber(value, 1), 200);
};

export const handleValidateNumberGreaterThanOrEqualToZero = async (c: Context): Promise<Response> => {
    const { value } = await c.req.json<SettingsValidationRequest<number>>();

    return c.json<SettingsValidationResponse>(validateNumber(value, 0), 200);
};

function validateNumber (value: number | undefined, minimum: number): SettingsValidationResponse {
    if (value !== undefined && (value < minimum || !Number.isInteger(value))) {
        return { success: false, error: `Value must be a whole number greater than or equal to ${minimum}` };
    }

    return { success: true };
}
