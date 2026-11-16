import { assert, describe, it } from "vitest";
import devvitConfig from "../../../devvit.json";
import { SchedulerJob } from "./constants.js";

const allEnumJobValues = Object.values(SchedulerJob).sort() as string[];

const devvitJobNames = Object.keys(devvitConfig.scheduler.tasks).sort();

describe("Scheduler job configuration parity", () => {
    it("has a devvit.json task for every scheduler job enum value", () => {
        const missingFromConfig = allEnumJobValues.filter(job => !devvitJobNames.includes(job));
        assert.deepEqual(missingFromConfig, []);
    });

    it("has a scheduler job enum value for every devvit.json task", () => {
        const missingFromEnum = devvitJobNames.filter(job => !allEnumJobValues.includes(job));
        assert.deepEqual(missingFromEnum, []);
    });
});
