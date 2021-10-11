import { App } from '@slack/bolt';
import { config as configDotenv } from 'dotenv';
import SlackRepository from './repositories/slackRepository';
import ConfigRepository from './repositories/configRepository';
import StateRepository from './repositories/stateRepository';
import DateService from './services/dateService';
import PlanningService from './services/planningService';
import RandomService from './services/randomService';

configDotenv();

const slack = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

const configRepository = new ConfigRepository();

const slackRepository = new SlackRepository(configRepository, slack);

const stateRepository = new StateRepository();

const dateService = new DateService();

const randomService = new RandomService();

const planningService = new PlanningService(stateRepository, dateService, randomService, slackRepository, configRepository);

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
    const userDetails = await slackRepository.getUsersDetails(users);
    console.log(userDetails);

    say(`Found ${userDetails.length} users in ${firstChannel.name}: ${userDetails.map((user) => user.real_name).join(', ')}.`);
  } else if (t.toLowerCase().startsWith('echo ')) {
    say(t.substr(5));
  } else if (t.includes('plan')){
    const channel = (await slackRepository.getChannels()).poolChannels[0];
    const event = await planningService.getNextEvent(channel.id!);
    const invitedUserIds = event.invites.map(inv => inv.userId);
    const invitedUserDetails = await slackRepository.getUsersDetails(invitedUserIds);
    const invitedUsers = invitedUserDetails.map(u => u.real_name);
    say(`Scheduled a new event for ${channel.name} on ${event.time.toUTCString()} for users ${invitedUsers.join(', ')}`)
  } else if (t.toLowerCase().includes('stop')){
    await slack.stop();
    console.log('App stopped!');
  } 
  else {
    say(`Hello ${(message as any).user}`!);
  }
});

(async () => {
  // Start your app
  await slack.start(Number(process.env.PORT) || 3000);

  console.log('⚡️ Bolt app is running!');
})();
