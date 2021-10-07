import { App } from '@slack/bolt';
import { config as configDotenv } from 'dotenv';
import getConfig from './configProvider';

configDotenv();

const slack = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

const getUsersInChannel = async (app: App) => {
  const config = await getConfig();

  // TODO
};

slack.message(async ({ message, say }) => {
  if (message.channel_type !== 'im') return;

  const t = (message as any).text;
  say(`Hello ${t}`);
});

(async () => {
  // Start your app
  await slack.start(Number(process.env.PORT) || 3000);

  console.log('⚡️ Bolt app is running!');
})();
