# Hive Protector

A Reddit app that can be used to ban users of "undesirable" subreddits from participating in another. Heavily inspired by SafestBot, which was no longer operational when this app was developed.

## Configuration Options

Enable functionality: This app will not run if it has been disabled. You may want to temporarily turn off the app without installing it, and this option gives you the ability to do this.

**List of Subreddits**: A comma-separated list of subreddits to ban users from e.g. FreeKarma4U,FreeKarmaForAll. Not case sensitive.

**Number of items to meet threshold**: A user must have at least this number of comments or posts to be banned by the bot.

**Number of days to monitor**: The app will only check a user's history back this many days. This can be used so that a user's old history is not held against them, or to ban only prolific users of "bad" subreddits.

**Behaviour if user was previously banned by this app**: How the app will behave if the user was previously banned by Hive Protector.

If you set this to "Never" (the default), the user will never be banned a second time. "Always re-ban" is self-explanatory, and "Ban if new content since previous ban" will only take into account posts or comments in the "bad" subreddits made after their bot ban.

Note: Very early versions of this app did not store the date of the ban. While the app will attempt to determine this via the mod log, this isn't foolproof. If the ban date cannot be determined, the ban date will be assumed to be 1st January 2024.

**Ban reason**: This is a message sent to the user when they are banned. Supports placeholder {{sublist}} which will be replaced with a comma-separated list of "bad" subs found on the user's history.

**Ban note**: This is a note to put in the mod log when a user is banned. Supports placeholder {{sublist}} which will be replaced with a comma-separated list of "bad" subs found on the user's history.

**Ban duration**: Allows you to specify a temporary or permanent ban. If the value is zero, the app will permanently ban the user.

**Exempt Approved Users**: Allows you to exclude users who are approved submitters from checks

## Operation notes

The app will only check a user once every two hours to avoid flooding the API with requests.

The app will never ban a user based on content in the subreddit the app is installed in - you cannot use this as a "ban anyone who posts or comments" bot.

## Data stored by the app

This app uses the Community Apps platform's Key value store plugin to store very basic information about users checked.

* The date and time that the app last checked a user, to support checking only once per hour
* User names of users who have been previously banned by the app, to prevent inadvertent re-banning.

## Feedback

If you have been banned by a subreddit using Hive Protector, please contact the subreddit that banned you.

For any feedback on the bot itself including bugs and enhancements, please post in /r/fsvapps or DM /u/fsv.
