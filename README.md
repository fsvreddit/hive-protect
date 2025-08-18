# Hive Protector

A Reddit app that can be used to ban, report or remove content from users of "undesirable" subreddits from participating in another. Originally inspired by SafestBot.

**Warning**: Use of this app to take action against users of subreddits on the basis of identity or vulnerability may be a breach of Reddit's [Mod Code of Conduct](https://support.reddithelp.com/hc/en-us/articles/27031206843156-Moderator-Code-of-Conduct-Rule-1-Create-Facilitate-and-Maintain-a-Stable-Community). Please be mindful of these rules and ensure that any ban messages or comment/post replies are civil and compliant with these policies.

### Detection Options

**List of Subreddits**: A comma-separated list of subreddits to ban users from e.g. FreeKarma4U, FreeKarmaForAll. Not case sensitive.

**List of Domains**: A comma-separated list of domains to watch for e.g. onlyfans.com, fansly.com. Don't include "www.". Wildcard support is also acceptable e.g. *.substack.com.

**Content type to act on**: You can choose whether to check user content when they submit posts, comments or both. You can also check a user's social links.

**Thresholds**: You can specify a combined posts and comments threshold, a posts threshold and comments threshold separately. Zero means that the threshold will not be checked. At least one threshold should have a value or the Social Links option should be on for the app to have any effect.

**Number of days to monitor**: The app will only check a user's history back this many days. This can be used so that a user's old history is not held against them, or to ban only prolific users of "bad" subreddits.

You can also choose to exempt Approved Users, specific users based on username and users based on specific flairs

### Ban options

Banning users is optional, you can choose to remove, report, reply or send modmail instead. Please consider informing users in the ban message which subreddits or domains that they were detected in, and I recommend having a transparent appeal process in place.

The application supports three main modes of handling users who have previously been banned by the app.

If you set this to "Never" (the default), the user will never be banned a second time. "Always re-ban" is self-explanatory, and "Ban if new content since previous ban" will only take into account posts or comments in the "bad" subreddits made after their bot ban.

### Other actions

You can choose to make a report on the user, remove their post/comment, reply to the user or notify sub moderators silently via Modmail.

## Operation notes

The app will only check a user once every 24 hours to avoid flooding the API with requests, it caches the results of the previous check. If a user is over the action threshold the cache duration is reduced to one hour.

However, if a user is unbanned, previously cached results are cleared because an unban may be as a result of a user cleaning up their profile, so it may need to be checked again.

The app will never ban a user based on content in the subreddit the app is installed in - you cannot use this as a "ban anyone who posts or comments" bot.

Hive Protector only looks back at a user's most recent 100 posts/comments, so detection will not be possible on older content.

## Example use cases

* Banning users who have participated in free karma subreddits
* Banning or reporting users from R4R subreddits who have posted in Onlyfans promo subs, or have posted Onlyfans/Fansly links anywhere on Reddit, or have an Onlyfans "social link" on their bio
* Banning or reporting users of fetish subreddits in SFW subreddits discussing the same topic (e.g. a women's hair styling subreddit might not welcome users with a hair fetish)
* Adding a sticky comment on a post in NSFW subreddits warning users about the user's post history in OF promotion subs/sharing OF links elsewhere
* Removing posts in a NSFW subreddit from users with participation history in teen-focussed subreddits or vice-versa

## Data stored by the app

This app uses the Community Apps platform's Redis plugin to store very basic information about users checked.

* The date and time that the app last checked a user, to support checking only once every 12 hours
* User names of users who have been previously banned by the app, along with the date/time of their ban, to prevent inadvertent re-banning.

All data is automatically removed if the app is uninstalled. If a user deletes their account, any data relating to them will be removed within 28 days.

## Change History

For older changes, please see the [change log](https://github.com/fsvreddit/hive-protect/blob/main/changelog.md).

### 1.11.2

* Add option to check user bios for domains
* Add option to exempt users based on flair CSS class
* Add option to exempt users based on account age and karma
* Add option to exempt users with low karma in detected subreddits
* Add option to exempt users via a menu item on posts and comments
* Add ability to send alerts to Slack/Discord when a user is flagged
* Add ability to set limit on the number of replies made to a user (e.g. if you only want to make one or two)
* Remove extra * characters on modmail messages
* Native ban notes now use "Bot Ban" type if ban option is enabled
* Remove global wildcard domain feature

### 1.10.27

* Redact domains in comment reply output that are known to be banned sitewide, preventing removals of messages by Admin

### 1.10.26

* No app changes, app readme update only.

### 1.10.25

* Reduce Dev Platform resource utilisation if "content types to check" is posts or comments, not both
* Added global wildcard support
* Add social URLs placeholder to ban message
* Update documentation to make mod responsibilities under the Mod Code of Conduct clear

### 1.10.23

* Add ability to stop sending modmails for a user after N approvals

### 1.10.20

* Add ability to add a mod note (native or Toolbox) when a user is found to have content in an undesirable subreddit

### 1.10.2

* Prevent duplicate ban messages that can be sent to users in some situations

### 1.10

* Add ability to choose whether posts and comments are removed as spam or as normal removes
* Add option to purge user content rather than just the latest comment

### 1.9.3

* Fixed bug with {{permalink}} placeholder substituting in the new comment/post's permalink not the latest "bad" item's permalink (introduced in 1.9)

## Feedback

If you have been banned by a subreddit using Hive Protector, please contact the subreddit that banned you.

For any feedback on the bot itself including bugs and enhancements, please post in /r/fsvapps or DM /u/fsv.

## Source code

This app is open source. You can find it on Github [here](https://github.com/fsvreddit/hive-protect).

With thanks to /u/Quick-Pumpkin-1259 for their contributions to the app's code.
