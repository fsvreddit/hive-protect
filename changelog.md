# Change log for Hive Protector

### 1.10.1

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
