import { SettingsFormField, SettingsFormFieldValidatorEvent } from "@devvit/public-api";
import { trimLeadingWWW } from "./utility.js";

export enum AppSetting {
    // Detection options
    Subreddits = "subreddits",
    IncludeAnyNSFWSub = "includeAnyNSFWSub",
    ExemptedNSFWSubs = "exemptedNSFWSubs",
    NumberOfSubredditsThatMustMatch = "numSubredditsToMatch",
    Domains = "domains",
    ContentTypeToActOn = "contenttypetoacton",
    CombinedItemCount = "itemcount",
    PostCount = "postcount",
    CommentCount = "commentcount",
    ExemptAccountsWithLowKarmaInProblematicSubs = "exemptAccountsWithKarmaInProblematicSubs",

    DaysToMonitor = "daystomonitor",
    CheckSocialLinks = "checkSocialLinks",
    CheckBioTextForLinks = "checkBioTextForLinks",

    // Exemption options
    ExemptApprovedUser = "exemptapproveduser",
    UserWhitelist = "userWhitelist",
    FlairWhitelist = "flairWhitelist",
    FlairCSSClassWhitelist = "flairCSSClassWhitelist",
    ExemptAccountOlderThanDays = "exemptAccountOlderThanDays",
    ExemptAccountWithThisLinkKarma = "exemptAccountWithThisLinkKarma",
    ExemptAccountWithThisCommentKarma = "exemptAccountWithThisCommentKarma",
    ExemptAccountWithThisLocalLinkKarma = "exemptAccountWithThisLocalLinkKarma",
    ExemptAccountWithThisLocalCommentKarma = "exemptAccountWithThisLocalCommentKarma",

    // Removal options
    RemoveEnabled = "removeenabled",
    RemoveAsSpam = "removeAsSpam",
    PurgeContent = "purgeContent",

    // Reply options
    ReplyTemplate = "removalreasontemplate",
    LockReply = "lockreply",
    StickyReply = "stickyreply",
    NumberOfRepliesToMake = "numberOfRepliesToMake",

    // Report options
    ReportEnabled = "reportenabled",
    ReportTemplate = "reporttemplate",
    ReportNumber = "reportnumber",

    // Modmail options
    ModmailEnabled = "modmailEnabled",
    ModmailNumber = "modmailNumber",

    // Daily digest options
    DailyDigestEnabled = "dailyDigestEnabled",

    // Mod note options
    ModNoteEnabled = "modNoteEnabled",
    ModNoteType = "modNoteType",
    ModNoteTemplate = "modNoteTemplate",

    // Alert by Discord/Slack options
    DiscordOrSlackWebhook = "discordOrSlackWebhook",
    DiscordSuppressEmbeds = "discordSuppressEmbeds",

    // Block Checker
    AntiBlockCheckerEnable = "antiBlockCheckerEnabled",
    AntiBlockCheckerAddModNote = "antiBlockCheckerAddModNote",

    // App scoped settings
    SitewideBannedDomains = "sitewideBannedDomains",
}

export enum ContentTypeToActOn {
    PostsAndComments = "all",
    PostsOnly = "posts",
    CommentsOnly = "comments",
}

export enum PurgeOption {
    None = "none",
    LastDay = "day",
    LastWeek = "week",
    LastMonth = "month",
    AllTime = "allTime",
}

// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
function selectFieldHasOptionChosen (event: SettingsFormFieldValidatorEvent<string[]>): void | string {
    if (event.value?.length !== 1) {
        return "You must choose an option";
    }
}

export const appSettings: SettingsFormField[] = [
    {
        type: "group",
        label: "Detection Options",
        helpText: "You should specify the NSFW subreddit option, a domains list, or both. If using the NSFW subreddit option, you should also specify at least one threshold (combined, posts, or comments). If no thresholds or detection options are specified, this app has no effect.",
        fields: [
            {
                type: "paragraph",
                name: AppSetting.Subreddits,
                label: "Enter a comma-separated list of subreddits to watch e.g. freekarma4u,freekarma4all",
                helpText: "Warning: targeting subreddits on the basis of identity or vulnerability may be a breach of Reddit's Mod Code of Conduct.",
            },
            {
                type: "boolean",
                name: AppSetting.IncludeAnyNSFWSub,
                label: "Action users with history in NSFW subreddits",
                defaultValue: false,
            },
            {
                type: "paragraph",
                name: AppSetting.ExemptedNSFWSubs,
                label: "Enter a comma-separated list of NSFW subreddits to exempt from checks. Omit leading 'r/'. Not case sensitive.",
            },
            {
                type: "number",
                name: AppSetting.NumberOfSubredditsThatMustMatch,
                label: "Number of subreddits from the above that user must have in their history for them to be actioned",
                helpText: "Useful if you want to catch users who have activity in at least N subreddits",
                defaultValue: 1,
            },
            {
                type: "paragraph",
                name: AppSetting.Domains,
                label: "Enter a comma-separated list of domains to watch e.g. onlyfans.com, fansly.com. Omit leading 'www.'. Supports wildcards e.g. *.substack.com.",
                onValidate: ({ value }) => {
                    if (!value) {
                        return;
                    }

                    const items = value.toLowerCase().split(",")
                        .map(domain => trimLeadingWWW(domain.trim()))
                        .filter(domain => domain !== "");

                    const disallowed = ["reddit.com", "redd.it"];

                    const badItems = items.filter(x => disallowed.includes(x) || disallowed.some(item => x.endsWith(`.${item}`)) || !x.includes("."));

                    if (badItems.length > 0) {
                        return `Invalid domains in list: ${badItems.join(", ")}`;
                    }
                },
            },
            {
                type: "select",
                name: AppSetting.ContentTypeToActOn,
                label: "Content type to act on",
                helpText: "If 'Posts Only' or 'Comments Only' are selected, the app will only check histories when that type of item is submitted",
                options: [
                    { label: "Posts and Comments", value: ContentTypeToActOn.PostsAndComments },
                    { label: "Posts Only", value: ContentTypeToActOn.PostsOnly },
                    { label: "Comments Only", value: ContentTypeToActOn.CommentsOnly },
                ],
                defaultValue: [ContentTypeToActOn.PostsAndComments],
                multiSelect: false,
                onValidate: selectFieldHasOptionChosen,
            },
            {
                type: "number",
                name: AppSetting.CombinedItemCount,
                label: "Number of posts and comments to meet threshold",
                helpText: "User must have at least this many posts or comments with a matching subreddit or domain to result in a report/removal. If zero, this threshold will be ignored.",
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
                helpText: "Only posts or comments within this number of days will be counted",
                defaultValue: 28,
                onValidate: ({ value }) => {
                    if (!value || value < 1) {
                        return "Days to monitor must be at least 1";
                    }
                },
            },
            {
                type: "number",
                name: AppSetting.ExemptAccountsWithLowKarmaInProblematicSubs,
                label: "Exempt accounts with below this much combined karma in NSFW subs",
                helpText: "If this option is selected, users with low karma in NSFW subs will be ignored. Set to zero to disable this check.",
                defaultValue: 0,
                onValidate: ({ value }) => {
                    if (value && value < 0) {
                        return "Exempt account karma must be at least 0";
                    }
                },
            },
            {
                type: "boolean",
                name: AppSetting.CheckSocialLinks,
                label: "Check social links",
                helpText: "User fails checks if they have any domain matches in their Social Links on their profile.",
                defaultValue: false,
            },
            {
                type: "boolean",
                name: AppSetting.CheckBioTextForLinks,
                label: "Check bio text for links",
                helpText: "User fails checks if they have any domain matches in their bio text.",
                defaultValue: false,
            },
        ],
    },
    {
        type: "group",
        label: "Exemption Options",
        fields: [
            {
                type: "boolean",
                name: AppSetting.ExemptApprovedUser,
                label: "Exempt approved users",
                helpText: "If this option is selected, approved users will not be checked.",
                defaultValue: false,
            },
            {
                type: "string",
                name: AppSetting.UserWhitelist,
                label: "Users to ignore",
                helpText: "A comma-separated list of users who are exempt from checks. Not case sensitive.",
            },
            {
                type: "string",
                name: AppSetting.FlairWhitelist,
                label: "Ignore users with these flairs",
                helpText: "A comma-separated list of user flairs that exempt users from checks. Case insensitive.",
            },
            {
                type: "string",
                name: AppSetting.FlairCSSClassWhitelist,
                label: "Ignore users with these flair CSS classes",
                helpText: "A comma-separated list of user flair CSS classes that exempt users from checks. Case insensitive.",
            },
            {
                type: "number",
                name: AppSetting.ExemptAccountOlderThanDays,
                label: "Exempt accounts older than this many days",
                helpText: "If an account is older than this many days, it will be exempt from checks. If zero, no accounts will be exempt.",
                defaultValue: 0,
                onValidate: ({ value }) => {
                    if (value && value < 0) {
                        return "Exempt account age must be at least 0";
                    }
                },
            },
            {
                type: "number",
                name: AppSetting.ExemptAccountWithThisLinkKarma,
                label: "Exempt accounts with this much post karma",
                helpText: "If an account has more post karma than this, it will be exempt from checks. If zero, no accounts will be exempt based on post karma.",
                defaultValue: 0,
            },
            {
                type: "number",
                name: AppSetting.ExemptAccountWithThisCommentKarma,
                label: "Exempt accounts with this much comment karma",
                helpText: "If an account has more comment karma than this, it will be exempt from checks. If zero, no accounts will be exempt based on comment karma.",
                defaultValue: 0,
            },
            {
                type: "number",
                name: AppSetting.ExemptAccountWithThisLocalLinkKarma,
                label: "Exempt accounts with this much post karma in this subreddit",
                helpText: "If an account has more post karma in this subreddit than this, it will be exempt from checks. If zero, no accounts will be exempt based on local post karma.",
                defaultValue: 0,
            },
            {
                type: "number",
                name: AppSetting.ExemptAccountWithThisLocalCommentKarma,
                label: "Exempt accounts with this much comment karma in this subreddit",
                helpText: "If an account has more comment karma in this subreddit than this, it will be exempt from checks. If zero, no accounts will be exempt based on local comment karma.",
                defaultValue: 0,
            },
        ],
    },
    {
        type: "group",
        label: "Action Options",
        fields: [
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
                    {
                        type: "boolean",
                        name: AppSetting.RemoveAsSpam,
                        label: "Remove as spam",
                        helpText: "If disabled, content will be removed normally",
                        defaultValue: false,
                    },
                    {
                        type: "select",
                        name: AppSetting.PurgeContent,
                        label: "Additionally, remove other content for the user from your subreddit",
                        options: [
                            { label: "Don't remove other content", value: PurgeOption.None },
                            { label: "Remove content from last 24h", value: PurgeOption.LastDay },
                            { label: "Remove content from last week", value: PurgeOption.LastWeek },
                            { label: "Remove content from last month", value: PurgeOption.LastMonth },
                            { label: "Remove all content", value: PurgeOption.AllTime },
                        ],
                        defaultValue: [PurgeOption.None],
                        multiSelect: false,
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
                        helpText: "Optional. If left blank, no reply will be left. Placeholders supported: {{sublist}}, {{domainlist}}, {{socialurls}}, {{permalink}} and {{username}}. Can be used either as a removal message, or as a notification if content is left up.",
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
                    {
                        type: "number",
                        name: AppSetting.NumberOfRepliesToMake,
                        label: "Number of replies to make",
                        helpText: "The number of replies to make to the user's content. If zero, there is no limit to the number of replies.",
                        defaultValue: 0,
                        onValidate: ({ value }) => {
                            if (value === undefined || value < 0) {
                                return "Number of replies must be at least 0.";
                            }
                        },
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
            {
                type: "group",
                label: "Modmail Options",
                fields: [
                    {
                        type: "boolean",
                        name: AppSetting.ModmailEnabled,
                        label: "Send modmail if user fails checks",
                        defaultValue: false,
                    },
                    {
                        type: "number",
                        name: AppSetting.ModmailNumber,
                        label: "Stop modmailing for user after this many approvals",
                        helpText: "Once user has been reported this many times, the app will no longer modmail for further content. If zero, the app will always send modmail.",
                        defaultValue: 3,
                    },
                ],
            },
            {
                type: "group",
                label: "Daily Digest Options",
                fields: [
                    {
                        type: "boolean",
                        name: AppSetting.DailyDigestEnabled,
                        label: "Send daily digest of users who failed checks to modmail",
                        helpText: "If enabled, the app will send a daily digest to modmail of all users who failed checks that day, along with the subreddits and domains that caused them to fail. This is a good option to enable if you don't want to risk modmail or report spam but still want to be notified of potential violators.",
                        defaultValue: false,
                    },
                ],
            },
            {
                type: "group",
                label: "Mod Note Options",
                fields: [
                    {
                        type: "boolean",
                        name: AppSetting.ModNoteEnabled,
                        label: "Add a mod note if user fails checks",
                        defaultValue: false,
                    },
                    {
                        type: "select",
                        name: AppSetting.ModNoteType,
                        label: "Type of mod note to add",
                        helpText: "Don't choose 'both' if you are using a notes synchronisation tool",
                        options: [
                            { label: "Native mod note", value: "native" },
                            { label: "Toolbox usernote", value: "toolbox" },
                            { label: "Both", value: "both" },
                        ],
                        defaultValue: ["native"],
                        multiSelect: false,
                    },
                    {
                        type: "string",
                        name: AppSetting.ModNoteTemplate,
                        label: "Template for mod note",
                        helpText: "Placeholders supported: {{sublist}}, {{domainlist}}.",
                        defaultValue: "User has history in: {{sublist}}",
                    },
                ],
            },
            {
                type: "group",
                label: "Alert by Discord or Slack",
                fields: [
                    {
                        type: "string",
                        name: AppSetting.DiscordOrSlackWebhook,
                        label: "Discord/Slack Webhook URL",
                        onValidate: ({ value }) => {
                            const webhookRegex = /^https:\/\/(?:discord(?:app)?\.com\/api\/webhooks\/|hooks\.slack\.com\/services)/;
                            if (value && !webhookRegex.test(value)) {
                                return "Please enter a valid Discord or Slack webhook URL";
                            }
                        },
                    },
                    {
                        type: "boolean",
                        name: AppSetting.DiscordSuppressEmbeds,
                        label: "Suppress Embeds (Discord only)",
                        helpText: "Controls whether Discord will display embeds with alerts. Turn this on to reduce clutter. Has no effect on Slack webhooks.",
                        defaultValue: false,
                    },
                ],
            },
            {
                type: "group",
                label: "Anti-Block Checker",
                fields: [
                    {
                        type: "boolean",
                        name: AppSetting.AntiBlockCheckerEnable,
                        label: "Check to see if users may be blocking /u/hive-protect",
                        helpText: "Users blocking this app may be doing so to evade blocks.",
                        defaultValue: false,
                    },
                    {
                        type: "boolean",
                        name: AppSetting.AntiBlockCheckerAddModNote,
                        label: "Add a mod note if user may be blocking /u/hive-protect",
                        helpText: "Requires the 'Check to see if users may be blocking /u/hive-protect' option to be enabled.",
                        defaultValue: false,
                    },
                ],
            },
        ],
    },
    {
        type: "string",
        name: AppSetting.SitewideBannedDomains,
        scope: "app",
        label: "Sitewide banned domains",
        defaultValue: "beacons.ai",
    },
];
