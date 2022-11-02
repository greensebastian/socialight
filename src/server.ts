import {
  App, BlockButtonAction, KnownEventFromType, SayFn,
} from '@slack/bolt';
import { config as configDotenv } from 'dotenv';
import { SecureContext } from 'tls';
import Config from './models/config';
import FileRepository from './repositories/fileRepository';
import EventService from './services/eventService';
import SlackService from './services/slackService';
import SchedulingService from './services/schedulingService';
import SlackRepository from './repositories/slackRepository';
import ConfigRepository from './repositories/configRepository';
import DateService from './services/dateService';
import PlanningService from './services/planningService';
import RandomService from './services/randomService';
import setupSecureCtx from './util/certUtil';

// const env = process.env.NODE_ENV || 'development';
const envPath = '.env';

configDotenv({ path: envPath });

const botAuthorInfo = {
  username: 'SociaLight',
  icon_emoji: ':pizza:',
};

// eslint-disable-next-line import/prefer-default-export
export function logTrace(userId: string, action: string, message: string) {
  console.log(`${userId}: ${action}: ${message}`);
}

const slack = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: process.env.SOCKET_MODE === 'true',
  appToken: process.env.SLACK_APP_TOKEN,
});

const configRepository = new ConfigRepository();

const slackRepository = new SlackRepository(configRepository, slack, botAuthorInfo);

const stateRepository = new FileRepository();

const dateService = new DateService();

const randomService = new RandomService();

const slackService = new SlackService(slackRepository, stateRepository, configRepository);

const eventService = new EventService(
  stateRepository,
  dateService,
  randomService,
  slackService,
  slackRepository,
);

const planningService = new PlanningService(
  stateRepository,
  dateService,
  randomService,
  slackRepository,
  configRepository,
  eventService,
  slackService,
);

const schedulingService = new SchedulingService(
  planningService,
  slackRepository,
  eventService,
  dateService,
  slackService,
  configRepository,
);

type Handler = (
  text: string,
  say: SayFn,
  message: KnownEventFromType<'message'>,
) => Promise<boolean>;

const channelsHandler: Handler = async (text, say) => {
  if (text.toLowerCase() !== 'channels') return false;

  const channels = await slackRepository.getChannels();
  const channelPairText = channels.map((channelPair) =>
    `[#${channelPair.poolChannel.name}] -> [#${channelPair.announcementsChannel.name}]`);

  await say(
    `Found channel pairs, [pool] -> [announcements]:\n${channelPairText.join('\n')}`,
  );

  return true;
};

const userHandler: Handler = async (text, say) => {
  if (text.toLowerCase() !== 'users') return false;

  const channels = await slackRepository.getChannels();
  const firstChannel = channels[0].poolChannel;
  const users = await slackRepository.getUsersInChannel(firstChannel.id!);
  const userDetails = await slackRepository.getUsersDetails(users);

  await say(
    `Found ${userDetails.length} users in ${firstChannel.name}: ${userDetails
      .map((user) => user.real_name)
      .join(', ')}.`,
  );
  return true;
};

const planHandler: Handler = async (text, say) => {
  if (text.toLowerCase() !== 'plan') return false;

  const channel = (await slackRepository.getChannels())[0].poolChannel;
  const event = await planningService.createEvent(channel.id!);

  const invitedUserIds = event!.invites.map((inv) => inv.userId);
  const invitedUserDetails = await slackRepository.getUsersDetails(invitedUserIds);
  const invitedUsers = invitedUserDetails.map((u) => u.real_name);
  await say(
    `Scheduled a new event for ${
      channel.name
    } on ${event.time.toUTCString()} for users ${invitedUsers.join(', ')}`,
  );
  return true;
};

const clearHandler: Handler = async (text, say) => {
  if (text.toLowerCase() !== 'clear') return false;

  await stateRepository.setEvents([]);
  await stateRepository.setOptedOut([]);
  await say('Cleared all planned events and opt-outs');
  return true;
};

const dumpHandler: Handler = async (text, say) => {
  if (text.toLowerCase() !== 'dump') return false;

  const events = await stateRepository.getEvents();
  await say('Outputting raw state data:');
  await say(JSON.stringify(events));
  return true;
};

const stopHandler: Handler = async (text, say) => {
  if (text.toLowerCase() !== 'stop') return false;

  await say('Stopping app...');
  await slack.stop();
  await schedulingService.stop();
  console.log('App stopped.');
  return true;
};

const tickHandler: Handler = async (text) => {
  if (text.toLowerCase() !== 'tick') return false;

  schedulingService.tick();
  return true;
};

const fallbackHandler: Handler = async (text, say) => {
  logTrace('?', text, 'reached fallback');
  await say(`I dont understand what you mean by '${text}' :exploding_head:`);
  return true;
};

const devHandlers: Handler[] = [
  channelsHandler,
  userHandler,
  planHandler,
  clearHandler,
  dumpHandler,
  stopHandler,
  tickHandler,
];

const handlers: Handler[] = [fallbackHandler];

const activeHandlers: Handler[] = [];

const registerHandlers = async (config: Config) => {
  if (config.development) {
    for (const devHandler of devHandlers) {
      activeHandlers.push(devHandler);
    }
  }

  for (const handler of handlers) {
    activeHandlers.push(handler);
  }
};

slack.action('optIn', async ({ ack, body }) => {
  await ack();
  const userId = body.user.id;
  logTrace(userId, 'optIn', 'Received opt in');
  await planningService.optIn(userId);
});

slack.action('optOut', async ({ ack, body }) => {
  await ack();
  const userId = body.user.id;
  logTrace(userId, 'optOut', 'Received opt out');
  await planningService.optOut(userId);
});

slack.action('acceptInvite', async ({ ack, body }) => {
  await ack();
  const actionBody = body as BlockButtonAction;
  const userId = actionBody.user.id;
  const eventId = actionBody.actions[0].value;

  logTrace(userId, 'acceptInvite', `Accepting invite for ${eventId}`);

  await eventService.handleUserAction('accept', userId, eventId);
});

slack.action('declineInvite', async ({ ack, body }) => {
  await ack();
  const actionBody = body as BlockButtonAction;
  const userId = actionBody.user.id;
  const eventId = actionBody.actions[0].value;

  logTrace(userId, 'declineInvite', `Declining invite for ${eventId}`);

  await eventService.handleUserAction('decline', userId, eventId);
});

slack.message(async ({ message, say }) => {
  if (message.channel_type !== 'im') return;

  // Catch "changed" messages of the bot changing it's own message
  if ((message as any).message?.subtype === 'bot_message') return;
  if ((message as any).message?.bot_id) return;

  // TODO handle event retries from Slack?

  const text = String((message as any).text);

  console.log(`Received command: '${text}'`);

  for (const handler of activeHandlers) {
    if (await handler(text, say, message)) return;
  }
});

slack.event('app_home_opened', async ({ event, logger }) => {
  try {
    const userEvents = await eventService.getUserEvents(event.user);
    await slackService.refreshHomeScreen(event.user, userEvents);
  } catch (error) {
    logger.error(error);
  }
});

(async () => {
  // Start your app
  const port = Number(process.env.PORT) || 3000;

  const getCtx = setupSecureCtx();

  if (getCtx()) {
    console.log('TLS settings were available during startup!');
  } else {
    console.warn('TLS was not found on startup!');
  }

  await slack.start(port, {
    SNICallback: (_: any, cb: (arg0: null, arg1: SecureContext | undefined) => void) => {
      cb(null, getCtx());
    },
  });

  await schedulingService.start();

  const config = await configRepository.getConfig();
  await registerHandlers(config);

  console.log('⚡️ Bolt app is running!');
})();
