import { Devvit, Context } from '@devvit/public-api';

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

  let contentFound: number = 0;

  const userContent = await context.reddit.getCommentsAndPostsByUser({
    username: userName,
    limit: 100,
    pageSize: 100,
    sort: "new"
  }).all();

  for (var item of userContent)
  {
    console.log(`Checking item in ${item.subredditName}.`)
    if (subredditList.indexOf(item.subredditName.toLowerCase()) > -1
      && Math.abs(new Date().getTime() - item.createdAt.getTime()) < timeDifference
    )
    {
      console.log("Yes, found one!");
      contentFound++;
    }
  }

  // Store record of last time checked
  await context.kvStore.put(`participation-lastcheck-${userName}`, new Date().getTime());

  return (contentFound >= threshold);

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

Devvit.addTrigger({
  event: 'PostSubmit',
  async onEvent(event, context) {

    if (!event.author)
    {
      console.log("A new post was created but couldn't find author!")
      return;
    }

    const userName = event.author.name;
    if (!event.subreddit)
    {
      console.log("Subreddit context not found, quitting");
      return;
    }

    var shouldBan = await userFailsChecks(context, event.subreddit.name);

    if (!shouldBan)
      return;

    await banUser(context, userName, event.subreddit.name);

    await context.kvStore.put(`participation-prevbanned-${userName}`, true);

    if (event.post)
    {
      const post = await context.reddit.getPostById(event.post.id);
      post.remove(true);
      console.log(`Removed postid ${event.post.id}`);
    }
  }
});

Devvit.addTrigger({
  event: 'CommentSubmit',
  async onEvent(event, context) {

    if (!event.author)
    {
      console.log("A new comment was created but couldn't find author!")
      return;
    }

    const userName = event.author.name;
    if (!event.subreddit)
    {
      console.log("Subreddit context not found, quitting");
      return;
    }

    var shouldBan = await userFailsChecks(context, userName);

    if (!shouldBan)
      return;

    await banUser(context, userName, event.subreddit.name);

    await context.kvStore.put(`participation-prevbanned-${userName}`, true);

    if (event.comment)
    {
      const comment = await context.reddit.getCommentById(event.comment.id);
      comment.remove(true);
      console.log(`Removed commentid ${event.comment.id}`);
    }

  }
});

Devvit.configure({
  redditAPI: true,
  kvStore: true
})

export default Devvit;
