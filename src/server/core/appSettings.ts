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
    VerboseLogs = "verboseLogs",
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
