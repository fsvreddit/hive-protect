# Hive Protector

A Reddit app that can be used to ban, report or remove content from users of "undesirable" subreddits from participating in another. Heavily inspired by SafestBot.

## Configuration

### Detection Options

**List of Subreddits**: A comma-separated list of subreddits to ban users from e.g. FreeKarma4U, FreeKarmaForAll. Not case sensitive.

**List of Domains**: A comma-separated list of domains to watch for e.g. onlyfans.com, fansly.com. Don't include "www.".

**Content type to act on**: You can choose whether to check user content when they submit posts, comments or both.

**Thresholds**: You can specify a combined posts and comments threshold, a posts threshold and comments threshold separately. Zero means that the threshold will not be checked. At least one threshold should have a value for the app to have any effect.

**Number of days to monitor**: The app will only check a user's history back this many days. This can be used so that a user's old history is not held against them, or to ban only prolific users of "bad" subreddits.

**Exempt Approved Users**: Allows you to exclude users who are approved submitters from checks

### Ban options

Banning users is optional, you can choose to remove, report or reply instead.

The application supports three main modes of handling users who have previously been banned by the app.

If you set this to "Never" (the default), the user will never be banned a second time. "Always re-ban" is self-explanatory, and "Ban if new content since previous ban" will only take into account posts or comments in the "bad" subreddits made after their bot ban.

### Remove Options

Allows you to specify if the user's content should be removed or not.

### Report Options

Allows you to specify if a user's content should be reported. Only works if removal is turned off.

### Reply Options

Allows you to specify a reply to be left against the post or comment. These will always be mod-distinguished and you can optionally choose to sticky replies to posts.

## Operation notes

The app will only check a user once every six hours to avoid flooding the API with requests, it caches the results of the previous check. If a user is over the action threshold the cache duration is reduced to one hour.

However, if a user is unbanned, previously cached results are cleared because an unban may be as a result of a user cleaning up their profile, so it may need to be checked again.

The app will never ban a user based on content in the subreddit the app is installed in - you cannot use this as a "ban anyone who posts or comments" bot.

## Example use cases

* Banning users who have participated in free karma subreddits
* Banning or reporting users from R4R subreddits who have posted in Onlyfans promo subs, or have posted Onlyfans/Fansly links anywhere on Reddit
* Adding a sticky comment on a post in NSFW subreddits warning users about the user's post history in OF promotion subs/sharing OF links elsewhere

## Data stored by the app

This app uses the Community Apps platform's Redis plugin to store very basic information about users checked.

* The date and time that the app last checked a user, to support checking only once every two hours
* User names of users who have been previously banned by the app, along with the date/time of their ban, to prevent inadvertent re-banning.

All data is automatically removed if the app is uninstalled. If a user deletes their account, any data relating to them will be removed within 24 hours.

## Changes in 1.7

- Add user whitelist function
- Exempts admins from all checks
- Fix issue with identifying ban date for post-ban checks.

## Changes in 1.6

- Domain detection now supports wildcarded domains e.g. *.blogspot.com
- Public comments made by the bot now include "I am a bot" boilerplate text.

## Changes in 1.5

- Add limit on number of times a user will get reported. By default, reports for a given user will stop after comments or posts flagged by this app have been approved three times, similar to Reddit's native ban evasion filter.
- Check for and remove stored data for deleted accounts.

## Changes in 1.4

Allow domain detection and optional separate thresholds for posts and comments

Allow replies to content without removing the content (the two options are now independent of each other)

## Changes in 1.3

You can now independently configure ban, remove and report options if you don't want to ban but might want to simply remove or bring a user to the mods' attention.

## Feedback

If you have been banned by a subreddit using Hive Protector, please contact the subreddit that banned you.

For any feedback on the bot itself including bugs and enhancements, please post in /r/fsvapps or DM /u/fsv.

## Source code

This app is open source. You can find it on Github [here](https://github.com/fsvreddit/hive-protect).
