# Hive Protector

A Reddit app that can be used to ban users of "undesirable" subreddits from participating in another. Heavily inspired by SafestBot (h/t /u/Blank-Cheque).

## Configuration Options

Enable functionality: This app will not run if it has been disabled. You may want to temporarily turn off the app without installing it, and this option gives you the ability to do this.

List of Subreddits: 

A comma-separated list of subreddits to ban users from e.g. FreeKarma4U,FreeKarmaForAll. Not case sensitive

Number of items to meet threshold: A user must have at least this number of comments or posts to be banned by the bot.

Number of days to monitor: The app will only check a user's history back this many days. This can be used so that a user's old history is not held against them, or to ban only prolific users of "bad" subreddits.

Ban reason: This is a message sent to the user when they are banned.

Exempt Approved Users: Allows you to exclude users who are approved submitters from checks

## Operation notes

The app will only check a user once per hour to avoid flooding the API with requests. 

If a user has previously banned by this app, it will never be re-banned by it. 

## Data stored by the app

This app uses the Community Apps platform's Key value store plugin to store very basic information about users checked.

* The date and time that the app last checked a user, to support checking only once per hour
* User names of users who have been previously banned by the app, to prevent inadvertent re-banning.