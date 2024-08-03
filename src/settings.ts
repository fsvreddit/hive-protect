import {SettingsFormField, SettingsFormFieldValidatorEvent} from "@devvit/public-api";

export enum AppSetting {
    Subreddits = "subreddits",
    Domains = "domains",
    ContentTypeToActOn = "contenttypetoacton",
    CombinedItemCount = "itemcount",
    PostCount = "postcount",
    CommentCount = "commentcount",
    DaysToMonitor = "daystomonitor",
    ExemptApprovedUser = "exemptapproveduser",
    UserWhitelist = "userWhitelist",
    BanEnabled = "banenabled",
    BehaviourIfPrevBan = "behaviourifprevban",
    BanMessage = "banmessage",
    BanNote = "bannote",
    BanDuration = "banduration",
    RemoveEnabled = "removeenabled",
    ReplyTemplate = "removalreasontemplate",
    LockReply = "lockreply",
    StickyReply = "stickyreply",
    ReportEnabled = "reportenabled",
    ReportTemplate = "reporttemplate",
    ReportNumber = "reportnumber",
}

export enum PrevBanBehaviour {
    NeverReBan = "never",
    AlwaysReBan = "always",
    OnlyRebanIfNewContent = "newonly",
}

export enum ContentTypeToActOn {
    PostsAndComments = "all",
    PostsOnly = "posts",
    CommentsOnly = "comments",
}

function selectFieldHasOptionChosen (event: SettingsFormFieldValidatorEvent<string[]>): void | string {
    if (!event.value || event.value.length !== 1) {
        return "You must choose an option";
    }
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
                label: "Enter a comma-separated list of domains to watch e.g. onlyfans.com, fansly.com. Omit leading 'www.'. Supports wildcards e.g. *.substack.com",
            },
            {
                type: "select",
                name: AppSetting.ContentTypeToActOn,
                label: "Content type to act on",
                helpText: "If 'Posts Only' or 'Comments Only' are selected, the app will only check histories when that type of item is submitted",
                options: [
                    {label: "Posts and Comments", value: ContentTypeToActOn.PostsAndComments},
                    {label: "Posts Only", value: ContentTypeToActOn.PostsOnly},
                    {label: "Comments Only", value: ContentTypeToActOn.CommentsOnly},
                ],
                defaultValue: [ContentTypeToActOn.PostsAndComments],
                multiSelect: false,
                onValidate: selectFieldHasOptionChosen,
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
            {
                type: "string",
                name: AppSetting.UserWhitelist,
                label: "Users to ignore",
                helpText: "A comma-separated list of users who are exempt from checks. Not case sensitive.",
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
                onValidate: selectFieldHasOptionChosen,
            },
            {
                type: "paragraph",
                name: AppSetting.BanMessage,
                label: "Enter a ban message to send to users",
                helpText: "Placeholders supported: {{sublist}}, {{domainlist}}, {{permalink}} and {{username}}. {{sublist}} and {{domainlist}} will be replaced with a comma-separated list of the matched subs or domains and {{permalink}} with the latest post or comment that was detected.",
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
                type: "paragraph",
                name: AppSetting.ReplyTemplate,
                label: "Leave a reply with a reply based on this template",
                helpText: "Optional. If left blank, no reply will be left. Placeholders supported: {{sublist}}, {{domainlist}}, {{permalink}} and {{username}}. Can be used either as a removal message, or as a notification if content is left up.",
            },
            {
                type: "boolean",
                name: AppSetting.LockReply,
                label: "Lock reply comment",
                defaultValue: true,
            },
            {
                type: "boolean",
                name: AppSetting.StickyReply,
                label: "Sticky reply comment",
                helpText: "Works on posts only. Replies to comments cannot be stickied",
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
                helpText: "Placeholders supported: {{sublist}}, {{domainlist}}.",
                defaultValue: "Content found in: {{sublist}}",
            },
            {
                type: "number",
                name: AppSetting.ReportNumber,
                label: "Stop reporting user after this many approvals",
                helpText: "Once user has been reported this many times, the app will no longer report further content. If zero, the app will always report.",
                defaultValue: 3,
            },
        ],
    },
];
