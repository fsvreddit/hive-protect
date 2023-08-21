import { Devvit, Context, Post, Comment } from '@devvit/public-api';

Devvit.addSettings([
  {
    type: 'boolean',
    name: 'enabled',
    label: 'Enable app'
  },
  {
    type: 'paragraph',
    name: 'subreddits',
    label: 'Enter a comma-separated list of subreddits to watch e.g. freekarma4u,freekarma4all'
  },
  {
    type: 'number',
    name: 'itemcount',
    label: 'Number of items to meet threshold',
    onValidate: async ({ value }) => {
      if (!value || value < 1) {
        return 'Item count must be at least 1';
      }
    },
  },
  {
    type: 'number',
    name: 'daystomonitor',
    label: 'Number of days to monitor',
    onValidate: async ({ value }) => {
      if (!value || value < 1) {
        return 'Days to monitor must be at least 1';
      }
    },
  },
  {
    type: 'paragraph',
    name: 'banmessage',
    label: 'Enter a ban reason to send to users'
  },
  {
    type: 'string',
    name: 'bannote',
    label: 'Enter a note to put in the ban log (optional)'
  },
  {
    type: 'boolean',
    name: 'exemptapproveduser',
    label: 'Exempt approved users'
  },
]);

async function userFailsChecks(context: Context, userName: string): Promise<boolean>
{
  const hiveProtectEnabled = await context.settings.get('enabled') as boolean | undefined;
  if (!hiveProtectEnabled)
  {
    console.log("Hive Protector not enabled, quitting");
    return false;
  }

  const subreddit = await context.reddit.getSubredditById(context.subredditId);

  // Is user a moderator?
  const modCheck = await subreddit.getModerators({
    username: userName
  }).all();

  if (modCheck.length > 0)
  {
    console.log(`${userName} is a moderator of /r/${subreddit.name}, quitting`);
    return false;
  }

  // Is user an approved user?
  const exemptApprovedUsers = await context.settings.get('exemptapproveduser') as boolean | undefined;
  console.log(`Should exempt approved users: ${exemptApprovedUsers}`);
  if (exemptApprovedUsers)
  {
    const approvedCheck = await subreddit.getApprovedUsers({
      username: userName
    }).all();

    if (approvedCheck.length > 0)
    {
      console.log(`${userName} is an approved user of /r/${subreddit.name}, quitting`);
      return false;
    }
  }

  const timeBetweenChecks = 60 * 60 * 1000; // One hour i.e. 60 minutes, 60 seconds, 1000 ms

  var lastCheckDate =  await context.kvStore.get(`participation-lastcheck-${userName}`) as number | undefined;
  if (lastCheckDate)
  {
    console.log(`Last check on ${userName} was at ${new Date(lastCheckDate)}`);
    if (lastCheckDate && Math.abs(new Date().getTime() - lastCheckDate) < timeBetweenChecks)
    {
      console.log(`Last check on ${userName} was within TTL period, quitting`);
      return false;
    }
  }
  else
    console.log(`Have never checked ${userName}.`);

  var wasPreviouslyBanned = await context.kvStore.get(`participation-prevbanned-${userName}`) as boolean | undefined;
  if (wasPreviouslyBanned)
  {
    console.log(`User ${userName} was previously banned, quitting`);
    return false;
  }

  const subReddits = await context.settings.get('subreddits') as string;
  var subredditList = subReddits.toLowerCase().split(",");
  for(var subName of subredditList)
  {
    subName = subName.trim(); // Trim leading and trailing whitespace
  }
  const threshold = await context.settings.get('itemcount') as number;
  const daysToMonitor = await context.settings.get('daystomonitor') as number;
  const timeDifference = daysToMonitor * 24 * 60 * 60 * 1000; // Time in ms i.e. hours times minutes times seconds times ms

  const userContent = await context.reddit.getCommentsAndPostsByUser({
    username: userName,
    limit: 100,
    pageSize: 100,
    sort: "new"
  }).all();

  const badSubItems = userContent.filter(item => subredditList.indexOf(item.subredditName.toLowerCase()) > -1 
    && Math.abs(new Date().getTime() - item.createdAt.getTime()) < timeDifference);

  console.log(`Found ${badSubItems.length} item(s) of content in monitored subreddits`);

  // Store record of last time checked
  await context.kvStore.put(`participation-lastcheck-${userName}`, new Date().getTime());

  return (badSubItems.length >= threshold);

};

async function banUser(context: Context, userName: string, subName: string): Promise<void>
{
  const banMessage = await context.settings.get('banmessage') as string;
  const banNote = await context.settings.get('bannote') as string;

  var banReason: string;
  if (banNote !== undefined && banNote.length > 0)
    banReason = 'Hive Protector: ' + banNote
  else
    banReason = 'Banned by Hive Protector';

  context.reddit.banUser({
    username: userName,
    reason: banReason,
    message: banMessage,
    subredditName: subName
  });
  console.log(`Banned ${userName} from ${subName}`);

  return;
}

async function processEvent(item: Post | Comment, context: Context): Promise<void>
{
  const userName = item.authorName;

  var shouldBan = await userFailsChecks(context, userName);

  if (!shouldBan)
    return;

  await banUser(context, userName, item.subredditName);

  await context.kvStore.put(`participation-prevbanned-${userName}`, true);

  await item.remove(true);
  console.log(`Removed item ${item.id}`);
}

Devvit.addTrigger({
  event: 'PostSubmit',
  async onEvent(event, context) {

    if (!event.post)
    {
      console.log("A new post was created, but is undefined");
      return;
    }

    const post = await context.reddit.getPostById(event.post.id);

    await processEvent(post, context);
  }
});

Devvit.addTrigger({
  event: 'CommentSubmit',
  async onEvent(event, context) {

    if (!event.comment)
    {
      console.log("A new comment was created, but is undefined");
      return;
    }
    const comment = await context.reddit.getCommentById(event.comment.id);
    
    await processEvent(comment, context);
  }
});

Devvit.configure({
  redditAPI: true,
  kvStore: true
})

export default Devvit;
