import { App } from '@slack/bolt';
import { config as configDotenv } from 'dotenv';
import ConfigRepository from './repositories/configProvider';
import SlackRepository from './repositories/slackRepository';

configDotenv();

const slack = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

const configRepository = new ConfigRepository();

const slackRepository = new SlackRepository(configRepository, slack);

slack.message(async ({ message, say }) => {
  if (message.channel_type !== 'im') return;

  const t = String((message as any).text);

  if (t.toLowerCase().startsWith('test channels')) {
    const channels = await slackRepository.getChannels();

    console.log(channels);

    const announcementText = channels.announcementsChannel ? `#${channels.announcementsChannel.name} to announce to` : 'no announcement channel';
    say(`Found ${announcementText} and channels ${channels.poolChannels.map((ch) => `#${ch.name}`).join(', ')} to pick participants from!`);
  } else if (t.toLowerCase().startsWith('test users')) {
    const channels = await slackRepository.getChannels();
    const firstChannel = channels.poolChannels[0];
    const users = await slackRepository.getUsersInChannel(firstChannel.id!);

    console.log(users);

    say(`Found ${users.length} users in ${firstChannel.name}: ${users.map((user) => user.real_name).join(', ')}.`);
  } else if (t.toLowerCase().startsWith('echo ')) {
    say(t.substr(5));
  } else {
    say(`Hello ${(message as any).user}`!);
  }
});

(async () => {
  // Start your app
  await slack.start(Number(process.env.PORT) || 3000);

  console.log('⚡️ Bolt app is running!');
})();
