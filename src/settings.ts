import {SettingsFormField} from "@devvit/public-api";

export enum AppSetting {
    Subreddits = "subreddits",
    Domains = "domains",
    CombinedItemCount = "itemcount",
    PostCount = "postcount",
    CommentCount = "commentcount",
    DaysToMonitor = "daystomonitor",
    ExemptApprovedUser = "exemptapproveduser",
    BanEnabled = "banenabled",
    BehaviourIfPrevBan = "behaviourifprevban",
    BanMessage = "banmessage",
    BanNote = "bannote",
    BanDuration = "banduration",
    RemoveEnabled = "removeenabled",
    ReplyTemplate = "removalreasontemplate",
    ReportEnabled = "reportenabled",
    ReportTemplate = "reporttemplate",
}

export enum PrevBanBehaviour {
    NeverReBan = "never",
    AlwaysReBan = "always",
    OnlyRebanIfNewContent = "newonly",
}

export const appSettings: SettingsFormField[] = [
    {
        type: "group",
        label: "Detection Options",
        helpText: "You should specify a subreddit list, a domains list, or both. You should also specify at least one threshold (combined, posts, or comments). If no thresholds or detection options are specified, this app has no effect.",
        fields: [
            {
                type: "paragraph",
                name: AppSetting.Subreddits,
                label: "Enter a comma-separated list of subreddits to watch e.g. freekarma4u,freekarma4all",
            },
            {
                type: "paragraph",
                name: AppSetting.Domains,
                label: "Enter a comma-separated list of domains to watch e.g. onlyfans.com, fansly.com. Omit leading 'www.'.",
            },
            {
                type: "number",
                name: AppSetting.CombinedItemCount,
                label: "Number of posts and comments to meet threshold",
                helpText: "User must have at least this many posts or comments with a matching subreddit or domain to result in a report/removal/ban. If zero, this threshold will be ignored.",
                defaultValue: 6,
            },
            {
                type: "number",
                name: AppSetting.PostCount,
                label: "Number of posts to meet threshold",
                helpText: "User must have at least this many posts with a matching subreddit or domain. Can work independently from the 'combined' count. If zero, this threshold will be ignored.",
                defaultValue: 0,
            },
            {
                type: "number",
                name: AppSetting.CommentCount,
                label: "Number of comments to meet threshold",
                helpText: "User must have at least this many comments with a matching subreddit or domain. Can work independently from the 'combined' count. If zero, this threshold will be ignored.",
                defaultValue: 0,
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
                type: "boolean",
                name: AppSetting.ExemptApprovedUser,
                label: "Exempt approved users",
                helpText: "If this option is selected, approved users will not be checked.",
            },
        ],
    },
    {
        type: "group",
        label: "Ban Options",
        fields: [
            {
                type: "boolean",
                name: AppSetting.BanEnabled,
                label: "Ban users over threshold",
                defaultValue: true,
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
                helpText: "Placeholders supported: {{sublist}}, {{domainlist}}, {{username}}. {{sublist}} and {{domainlist}} will be replaced with a comma-separated list of the matched subs or domains",
            },
            {
                type: "string",
                name: AppSetting.BanNote,
                label: "Enter a note to put in the ban log (optional)",
                helpText: "Placeholder supported: {{sublist}}, {{domainlist}}. These will be replaced with a comma-separated list of the matched subs or domains",
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
        ],
    },
    {
        type: "group",
        label: "Remove Options",
        fields: [
            {
                type: "boolean",
                name: AppSetting.RemoveEnabled,
                label: "Remove posts and comments over threshold",
                defaultValue: true,
            },
        ],
    },
    {
        type: "group",
        label: "Reply options",
        fields: [
            {
                type: "string",
                name: AppSetting.ReplyTemplate,
                label: "Leave a locked reply with a reply based on this template",
                helpText: "Optional. If left blank, no reply will be left. Placeholders supported: {{sublist}}, {{domainlist}}, {{username}}. Can be used either as a removal message, or as a notification if content is left up.",
            },
        ],
    },
    {
        type: "group",
        label: "Report Options",
        helpText: "Report options only work if comments are left up on the subreddit.",
        fields: [
            {
                type: "boolean",
                name: AppSetting.ReportEnabled,
                label: "Report posts and comments over threshold",
                defaultValue: false,
            },
            {
                type: "string",
                name: AppSetting.ReportTemplate,
                label: "Template for report reason",
                helpText: "Placeholder supported: {{sublist}}",
            },
        ],
    },
];
