import { Event, Invite } from '@models/event';
import SlackRepository from '@repositories/slackRepository';
import { SayFn } from '@slack/bolt';
import dayjs from 'dayjs';
import DateService from './dateService';
import EventService from './eventService';

export const respondMkdwn = 'Respond by writing :white_check_mark: *accept* or :x: *decline*';

const dateFormat = (date: Date) => {
  const d = dayjs(date);
  return d.format('dddd D MMMM, HH:mm');
};

const makeAt = (text: string) => `<@${text}>`;

const makeChannel = (channelId: string) => `<#${channelId}>`;

const channelDate = (channelId: string, date: Date) => {
  const text = `${makeChannel(channelId)} on *${dateFormat(date)}*`;
  return text;
};

const inviteRow = (event: Event, userId: string, now: Date) => {
  const dayDiff = dayjs(event.time).startOf('day').diff(dayjs(now).startOf('day'), 'day');
  let status: string;
  if (event.accepted.includes(userId)) {
    status = 'have :white_check_mark: *accepted* this event :pizza:';
  } else if (event.declined.includes(userId)) {
    status = 'have :x: *declined* the invite.';
  } else if (event.invites.find((inv) => inv.userId === userId)) {
    status = `have :love_letter: *received* an invite.\n${respondMkdwn}!`;
  } else {
    status = 'dont have a status for this event, that\'s odd :eyes:';
  }
  return `${channelDate(event.channelId, event.time)}, ${dayDiff} day(s) from now.\nYou ${status}`;
};

class SlackService {
  private cachedAnnouncementChannelId: string | undefined = undefined;

  constructor(private slackRepository: SlackRepository, private dateService: DateService) {}

  private info = async () => `This bot invites people at random to join up and have pizza together. When an event is successfully planned, it is announced to ${makeChannel(await this.announcementChannelId())}\n\nSend 'help' to list available commands!`;

  async sendInvite(invite: Invite, channelId: string, date: Date) {
    await this.slackRepository.sendMarkdownToUser(invite.userId, `You've been invited to have pizza with ${channelDate(channelId, date)}!\n\n${respondMkdwn}!\n\n${await this.info()}`);
  }

  async sendReminder(invite: Invite, channelId: string, date: Date) {
    await this.slackRepository.sendMessage(invite.userId, `Dont forget to respond to your invite to have pizza with ${channelDate(channelId, date)}\n\n${respondMkdwn}!`);
  }

  async sendAnnouncement(event: Event) {
    const users = await this.slackRepository.getUsersDetails(event.accepted);
    const usersText = users.map((user) => user.name!).map(makeAt).join(', ');
    const intro = `Successfully scheduled event for ${channelDate(event.channelId, event.time)} :pizza:`;
    const content = `${usersText} will meet up and have pizza together.`;

    // Currently not enabled as it requires channels:manage permission which is a bit much
    // await this.ensureInvitedToChannel(event.accepted);
    const announcement = `${intro}\n\n${content}`;
    await this.slackRepository.sendAnnouncement(announcement);
    await Promise.all(
      event.accepted.map((user) => this.slackRepository.sendMarkdownToUser(user, announcement)),
    );
  }

  private async announcementChannelId() {
    if (!this.cachedAnnouncementChannelId) {
      this.cachedAnnouncementChannelId = (await this.slackRepository.getChannels())
        .announcementsChannel?.id;
    }

    return this.cachedAnnouncementChannelId!;
  }

  private async ensureInvitedToChannel(userIds: string[]) {
    await this.slackRepository.inviteToChannel(userIds, await this.announcementChannelId());
  }

  async sendAcceptResult(event: Event | undefined, userId: string) {
    const message = event ? `Successfully *accepted* event with ${channelDate(event.channelId, event.time)}.` : 'Failed to accept invite, maybe you already answered all invites?';
    await this.slackRepository.sendMarkdownToUser(userId, message);
  }

  async sendDeclineResult(event: Event | undefined, userId: string) {
    const message = event ? `Successfully *declined* event with ${channelDate(event.channelId, event.time)}.` : 'Failed to decline invite, maybe you already answered all invites?';
    await this.slackRepository.sendMarkdownToUser(userId, message);
  }

  async sendFailedEventNotification(event: Event, involvedUserIds: string[]) {
    const acceptedUsers = await this.slackRepository.getUsersDetails(event.accepted);
    const message = `Event scheduled for ${channelDate(event.channelId, event.time)} was cancelled due to not enough people accepting on time :cry:\n\nUsers (*${acceptedUsers.map((u) => u.name!).map(makeAt).join(', ')})* accepted the invite, feel free to reach out to them for support!`;
    await Promise.all(
      involvedUserIds.map((userId) => this.slackRepository.sendMarkdownToUser(userId, message)),
    );
  }

  async sendOptedOut(userId: string) {
    await this.slackRepository.sendMessage(userId, 'Successfully opted out and declined pending invitations!');
  }

  static async sendCommandList(say: SayFn) {
    const commandList = 'The bot responds to the following commands:\n\n *events* | Lists events you are involved in.\n *accept* | Accepts the *NEXT* event you have yet to respond to.\n *decline* | Declines the *NEXT* event you have yet to respond to.\n *opt out* | Opts you out of being invited to events by the bot. Opting out will decline all unanswered invitations.\n *opt in* | Opts you in to being invited by the bot.';
    const info = 'You have *1 day* to response to invites :alarm_clock: otherwise your invite will be passed on to someone else.';

    const text = `${commandList}\n\n${info}`;

    const blocks = [{
      type: 'section',
      text: {
        type: 'mrkdwn',
        text,
      },
    }];

    await say({ blocks, text });
  }

  async sendInviteList(events: Event[], userId: string, say: SayFn) {
    let mkdown: string;
    if (events.length === 0) mkdown = 'You don\'t have any upcoming events!';
    else {
      const now = this.dateService.now();
      EventService.sortByDate(events);
      mkdown = `Your have the following event(s):\n\n ${events.map((event) => `${inviteRow(event, userId, now)}`).join('\n\n')}`;
    }

    const blocks = [{
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: mkdown,
      },
    }];

    await say({ blocks, text: mkdown });
  }
}

export default SlackService;
