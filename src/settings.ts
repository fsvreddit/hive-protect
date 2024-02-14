import {SettingsFormField} from "@devvit/public-api";

export enum AppSetting {
    Subreddits = "subreddits",
    ItemCount = "itemcount",
    DaysToMonitor = "daystomonitor",
    BehaviourIfPrevBan = "behaviourifprevban",
    BanMessage = "banmessage",
    BanNote = "bannote",
    BanDuration = "banduration",
    ExemptApprovedUser = "exemptapproveduser",
}

export enum PrevBanBehaviour {
    NeverReBan = "never",
    AlwaysReBan = "always",
    OnlyRebanIfNewContent = "newonly",
}

export const appSettings: SettingsFormField[] = [
    {
        type: "paragraph",
        name: AppSetting.Subreddits,
        label: "Enter a comma-separated list of subreddits to watch e.g. freekarma4u,freekarma4all",
    },
    {
        type: "number",
        name: AppSetting.ItemCount,
        label: "Number of posts and comments to meet threshold",
        helpText: "User must have at least this many posts or comments in 'bad' subreddits to result in a removal/ban",
        defaultValue: 6,
        onValidate: ({value}) => {
            if (!value || value < 1) {
                return "Threshold must be at least 1";
            }
        },
    },
    {
        type: "number",
        name: AppSetting.DaysToMonitor,
        label: "Number of days to monitor",
        helpText: "Only comments within this number of days will be counted",
        defaultValue: 28,
        onValidate: ({value}) => {
            if (!value || value < 1) {
                return "Days to monitor must be at least 1";
            }
        },
    },
    {
        type: "select",
        name: AppSetting.BehaviourIfPrevBan,
        label: "Behaviour if user was previously banned by this app",
        options: [
            {label: "Never re-ban", value: PrevBanBehaviour.NeverReBan},
            {label: "Always ban", value: PrevBanBehaviour.AlwaysReBan},
            {label: "Ban if new content since previous ban", value: PrevBanBehaviour.OnlyRebanIfNewContent},
        ],
        defaultValue: [PrevBanBehaviour.NeverReBan],
        multiSelect: false,
    },
    {
        type: "paragraph",
        name: AppSetting.BanMessage,
        label: "Enter a ban message to send to users",
        helpText: "Placeholder supported: {{sublist}}. This will be replaced with a comma-separated list of the matched subs",
    },
    {
        type: "string",
        name: AppSetting.BanNote,
        label: "Enter a note to put in the ban log (optional)",
        helpText: "Placeholder supported: {{sublist}}. This will be replaced with a comma-separated list of the matched subs",
    },
    {
        type: "number",
        name: AppSetting.BanDuration,
        label: "Duration of ban in days (if 0 or blank, defaults to permanent)",
        onValidate: ({value}) => {
            if (value && (value < 0 || value > 999)) {
                return "Ban duration must be a number between 0 and 999";
            }
        },
    },
    {
        type: "boolean",
        name: AppSetting.ExemptApprovedUser,
        label: "Exempt approved users",
        helpText: "If this option is selected, approved users will not be checked.",
    },
];
