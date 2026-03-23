# Hive Protector

A Reddit app that can be used to report or remove content from users of "undesirable" subreddits, NSFW subreddits or with social links with specified domains from participating in another.

**Warning**: Use of this app to take action against users of subreddits on the basis of identity or vulnerability may be a breach of Reddit's [Mod Code of Conduct](https://support.reddithelp.com/hc/en-us/articles/27031206843156-Moderator-Code-of-Conduct-Rule-1-Create-Facilitate-and-Maintain-a-Stable-Community). Please be mindful of these rules and ensure that any comment/post replies are civil and compliant with these policies.

### Detection Options

**List of Subreddits**: A comma-separated list of subreddits to ban users from e.g. FreeKarma4U, FreeKarmaForAll. Not case sensitive.

**Action users with history in NSFW subreddits**: Whether to take action against users of NSFW subreddits. Useful if you have tightly SFW spaces such as those aimed at younger users.

**List of Domains**: A comma-separated list of domains to watch for e.g. onlyfans.com, fansly.com. Don't include "www.". Wildcard support is also acceptable e.g. *.substack.com.

**Content type to act on**: You can choose whether to check user content when they submit posts, comments or both. You can also check a user's social links and bio text for domains.

**Thresholds**: You can specify a combined posts and comments threshold, a posts threshold and comments threshold separately. Zero means that the threshold will not be checked. At least one threshold should have a value or the Social Links option should be on for the app to have any effect.

**Number of days to monitor**: The app will only check a user's history back this many days. This can be used so that a user's old history is not held against them, or to ban only prolific users of NSFW subreddits.

You can also choose to exempt Approved Users, specific users based on username and users based on specific flairs, or users with low karma in NSFW subreddits.

### Action options

You can choose to do any of the following:

* Remove content
* Report content
* Reply to content
* Send modmail immediately
* Send a daily summary to modmail of all users detected
* Alert via a Discord or Slack webhook
* Add mod note (native or Toolbox)

Ban functionality was removed in version 2.0 due to changes in Admin policies on ban bots. Accounts can still be banned manually after reviewing them individually.

## Operation notes

The app will only check a user's history once every 24 hours to avoid flooding the API with requests, it caches the results of the previous check. If a user is over the action threshold the cache duration is reduced to one hour.

The app will never action a user based on content in the subreddit the app is installed in.

Hive Protector only looks back at a user's most recent 100 posts/comments, so detection will not be possible on older content.

## Example use cases

* Identifying users who have participated in free karma subreddits
* Identifying users with OnlyFans or similar links who may be using SFW subreddits (or non-promotional NSFW subreddits) to promote indirectly
* Identifying users of fetish subreddits in SFW subreddits discussing the same topic (e.g. a women's hair styling subreddit might not welcome users with a hair fetish)
* Identifying users with participation in NSFW subreddits posting in SFW safe spaces, especially teen subreddits or subreddits for hair and beauty
* Adding a sticky comment on a post in NSFW subreddits warning users about the user's post history in OF promotion subs/sharing OF links elsewhere
* Removing posts in a NSFW subreddit from users with participation history in teen-focussed subreddits or vice-versa

## Data stored by the app

This app uses the Community Apps platform's Redis plugin to store very basic information about users checked.

* The date and time that the app last checked a user, to support checking only once every 12 hours

All data is automatically removed if the app is uninstalled. If a user deletes their account, any data relating to them will be removed within 28 days.

## Change History

For older changes, please see the [change log](https://github.com/fsvreddit/hive-protect/blob/main/changelog.md).

### v2.0.1

* Fix issue that prevented checks from working if only a sub list was defined
* Fix issue with daily digest modmail message not sending

### v2.0

* Remove ban functionality due to changes in Reddit policies on ban bots.
* Add feature to send a daily modmail message with all detected users.
* Allow users to be exempted from checks based on their subreddit-specific karma.

## Feedback

For any feedback on the app itself including bugs and enhancements, please send a message to /u/fsv. Note that the ban options will not be returning due to changes in Admin policy on ban bots.

## Source code

This app is open source. [You can find it on Github here](https://github.com/fsvreddit/hive-protect).
