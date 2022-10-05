import {
  App, BlockButtonAction, KnownEventFromType, RespondArguments, SayFn, SectionBlock,
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
import {
  getAcceptResponseBlock,
  getDeclineResponseBlock,
} from './util/blocks';

// const env = process.env.NODE_ENV || 'development';
const envPath = '.env';

configDotenv({ path: envPath });

const botAuthorInfo = {
  username: 'SociaLight',
  icon_emoji: ':pizza:',
};

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

const eventService = new EventService(stateRepository, dateService, randomService);

const slackService = new SlackService(slackRepository, stateRepository, eventService);

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

const getUserId = (message: KnownEventFromType<'message'>) => String((message as any).user);

const getThreadId = (message: KnownEventFromType<'message'>) => String((message as any).thread_ts);

const createResponseMessage = (blocks: SectionBlock[]): RespondArguments => {
  const response: RespondArguments = {
    blocks,
    replace_original: true,
    // ...botAuthorInfo,
  } as RespondArguments;
  return response;
};

type Handler = (
  text: string,
  say: SayFn,
  message: KnownEventFromType<'message'>,
) => Promise<boolean>;

const channelsHandler: Handler = async (text, say) => {
  if (text.toLowerCase() !== 'channels') return false;

  const channels = await slackRepository.getChannels();
  const announcementText = channels.announcementsChannel
    ? `#${channels.announcementsChannel.name} to announce to`
    : 'no announcement channel';
  await say(
    `Found ${announcementText} and channels ${channels.poolChannels
      .map((ch) => `#${ch.name}`)
      .join(', ')} to pick participants from!`,
  );
  return true;
};

const userHandler: Handler = async (text, say) => {
  if (text.toLowerCase() !== 'users') return false;

  const channels = await slackRepository.getChannels();
  const firstChannel = channels.poolChannels[0];
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

  const channel = (await slackRepository.getChannels()).poolChannels[0];
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

const acceptHandler: Handler = async (text, say, message) => {
  if (text.toLowerCase() !== 'accept') return false;
  
  const userId = getUserId(message);
  const event = await eventService.acceptInvitationByThreadId(userId, getThreadId(message));
  if (!event) return false;
  await slackService.refreshHomeScreen(userId);
  return true;
};

const declineHandler: Handler = async (text, say, message) => {
  if (text.toLowerCase() !== 'decline') return false;

  const userId = getUserId(message);
  const event = await eventService.declineInvitationByThreadId(userId, getThreadId(message));
  if (!event) return false;
  await slackService.refreshHomeScreen(userId);
  return true;
};

const tickHandler: Handler = async (text) => {
  if (text.toLowerCase() !== 'tick') return false;

  schedulingService.tick();
  return true;
};

const fallbackHandler: Handler = async (text, say) => {
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

const handlers: Handler[] = [acceptHandler, declineHandler, fallbackHandler];

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
  await planningService.optIn(userId);
  await slackService.refreshHomeScreen(userId);
});

slack.action('optOut', async ({ ack, body }) => {
  await ack();
  const userId = body.user.id;
  await planningService.optOut(userId);
  await slackService.refreshHomeScreen(userId);
});

slack.action('acceptInvite', async ({ ack, body, respond }) => {
  await ack();
  const actionBody = body as BlockButtonAction;
  const userId = actionBody.user.id;
  const eventId = actionBody.actions[0].value;

  if (!userId || !eventId) throw new Error('Missing user or event id');

  const event = await eventService.acceptInvitation(userId, eventId);
  if (!event) return;
  const { blocks } = getAcceptResponseBlock(event.channelId, event.time);
  await slackService.refreshHomeScreen(userId);

  if (respond) {
    await respond(createResponseMessage(blocks));
  }
});

slack.action('declineInvite', async ({ ack, body, respond }) => {
  await ack();
  const actionBody = body as BlockButtonAction;
  const userId = actionBody.user.id;
  const eventId = actionBody.actions[0].value;

  if (!userId || !eventId) throw new Error('Missing user or event id');

  const event = await eventService.declineInvitation(userId, eventId);
  if (!event) return;
  const { blocks } = getDeclineResponseBlock(event.channelId, event.time);
  await slackService.refreshHomeScreen(userId);

  if (respond) {
    await respond(createResponseMessage(blocks));
  }
});

slack.message(async ({ message, say }) => {
  if (message.channel_type !== 'im') return;

  // TODO handle event retries from Slack?

  const text = String((message as any).text);

  console.log(`Received command: '${text}'`);

  for (const handler of activeHandlers) {
    if (await handler(text, say, message)) return;
  }
});

slack.event('app_home_opened', async ({ event, logger }) => {
  try {
    await slackService.refreshHomeScreen(event.user);
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
