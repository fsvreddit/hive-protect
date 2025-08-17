# Change log for Hive Protector

### 1.11.1

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

### 1.9.2

* Fixed a bug that would prevent users with matches by subreddit only from being picked up

### 1.9

* You can now specify that at least N subreddits match
* App now prevents ban messages/notes that are too long
* Anti block checker - alert if a user may be blocking this app.
* Bug fixes

### 1.8.2

* App can now check a user's social links (note: I cannot yet check users' bio text)
* Reporting now happens before removal, which means more context is available to mods
* Add option to notify by Modmail
* Add option to skip remove/report/modmail options if user was previously unbanned
* Add user flair whitelist

### 1.7

* Add user whitelist function
* Exempts admins from all checks
* Fix issue with identifying ban date for post-ban checks.

### 1.6

* Domain detection now supports wildcarded domains e.g. *.blogspot.com
* Public comments made by the bot now include "I am a bot" boilerplate text.

### 1.5

* Add limit on number of times a user will get reported. By default, reports for a given user will stop after comments or posts flagged by this app have been approved three times, similar to Reddit's native ban evasion filter.
* Check for and remove stored data for deleted accounts.

### 1.4

Allow domain detection and optional separate thresholds for posts and comments

Allow replies to content without removing the content (the two options are now independent of each other)

### 1.3

You can now independently configure ban, remove and report options if you don't want to ban but might want to simply remove or bring a user to the mods' attention.
