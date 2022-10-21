import { Event, EventUtil, Invite } from '@models/event';
import DateService from '@services/dateService';
import { Guid } from 'guid-typescript';
import { IStateRepository } from 'core/interface';
import RandomService from './randomService';
import { getAcceptResponseBlock, getDeclineResponseBlock, getExpireResponseBlock } from '../util/blocks';
import SlackService from './slackService';
import SlackRepository from '../repositories/slackRepository';

function getResponseBlock(action: 'accept' | 'decline' | 'expire', channelId: string, date: Date) {
  switch (action) {
    case 'accept': return getAcceptResponseBlock(channelId, date);
    case 'decline': return getDeclineResponseBlock(channelId, date);
    case 'expire': return getExpireResponseBlock(channelId, date);
    default: throw new Error(`Unknown user action: "${action}"`);
  }
}

class EventService {
  constructor(
    private stateRepository: IStateRepository,
    private dateService: DateService,
    private randomService: RandomService,
    private slackService: SlackService,
    private slackRepository: SlackRepository,
  ) {}

  /**
   * Find all created events
   * @param expired if true, include previous events
   * @returns array of all events
   */
  async getAllEvents(expired: boolean = false): Promise<Event[]> {
    const events = await this.stateRepository.getEvents();
    EventService.sortByDate(events);
    return expired ? events : events.filter((event) => event.time > this.dateService.now());
  }

  /**
   * Find specific event
   * @param eventId
   * @returns array of all events
   */
  private async getEvent(eventId: string): Promise<Event | undefined> {
    const events = await this.stateRepository.getEvents();
    return events.find((ev) => ev.id === eventId);
  }

  /**
   * Find all events for a certain user
   * @param userId Id of user to find events for
   * @param expired if true, include previous events
   * @returns array of all events
   */
  async getUserEvents(userId: string, expired: boolean = false): Promise<Event[]> {
    const events = await this.getAllEvents(expired);
    const userEvents = events.filter(
      (event) => EventUtil.isInvolved(event, userId),
    );
    return userEvents;
  }

  /**
   * Finds or creates a new event for the selected channel
   * @param channelId Id of channel to get or create event for
   * @returns The next event for the selected channel
   */
  async createEvent(channelId: string, date: Date, userIds: string[]): Promise<Event> {
    const event: Event = {
      id: Guid.create().toString(),
      channelId,
      time: date,
      declined: [],
      accepted: [],
      announced: false,
      invites: await EventService.createInvites(userIds),
    };

    const events = await this.getAllEvents(false);
    events.push(event);
    await this.stateRepository.setEvents(events);

    return event;
  }

  /**
   * Accepts the first event the user is invited to
   * @param userId Slack ID of user to accept
   * @returns true if an invitation was successfully accepted
   */
  private async acceptInvitation(
    userId: string,
    eventId: string,
  ): Promise<Event | undefined> {
    const data = await this.getInvite(userId, eventId);
    if (data) {
      return this.acceptEvent(data.event, userId);
    }
    return undefined;
  }

  private async getInvite(userId: string, eventId: string):
    Promise<{invite: Invite, event: Event} | undefined> {
    const event = await this.getEvent(eventId);
    if (!event) return undefined;

    const invite = event.invites.find((inv) => inv.userId === userId);
    if (!invite) return undefined;

    return {
      event,
      invite,
    };
  }

  /**
   * Declines the first event the user is invited to
   * @param userId Slack ID of user to decline
   * @returns true if an invitation was successfully declined
   */
  private async declineInvitation(
    userId: string,
    eventId: string,
  ): Promise<Event | undefined> {
    const event = await this.getEvent(eventId);
    if (!event) return undefined;

    const userInvite = event.invites.find((invite) => invite.userId === userId);
    if (userInvite) {
      return this.declineEvent(event, userId);
    }
    return undefined;
  }

  async inviteToEvent(event: Event, userIds: string[]) {
    const updatedEvent = EventUtil.invite(event, userIds);
    await this.updateEvent(updatedEvent);
  }

  private async acceptEvent(event: Event, userId: string): Promise<Event> {
    const newEvent = EventUtil.acceptEvent(event, userId);
    await this.updateEvent(newEvent);
    return newEvent;
  }

  private async declineEvent(event: Event, userId: string): Promise<Event> {
    const newEvent = EventUtil.declineEvent(event, userId);
    await this.updateEvent(newEvent);
    return newEvent;
  }

  async updateEvent(newEvent: Event) {
    const events = await this.getAllEvents();
    if (!events.find((ev) => ev.id === newEvent.id)) return;

    const updatedEvents = events.filter((event) => event.id !== newEvent.id);
    updatedEvents.push(newEvent);
    await this.stateRepository.setEvents(updatedEvents);
  }

  async finalizeAndUpdateEvent(event: Event) {
    const reservationUser = this.randomService.shuffleArray(event.accepted)[0];
    const remainingAcceptedUsers = event.accepted.filter((user) => user !== reservationUser);
    const expenseUser = remainingAcceptedUsers.length > 0
      ? remainingAcceptedUsers[0]
      : reservationUser;

    const updatedEvent = EventUtil.announceAndFinalize(event, reservationUser, expenseUser);

    await this.updateEvent(updatedEvent);
    return updatedEvent;
  }

  async handleUserAction(
    action: 'accept' | 'decline' | 'expire',
    userId: string | undefined,
    eventId: string | undefined,
  ): Promise<void> {
    if (!userId || !eventId) throw new Error('Missing user or event id');

    const invite = (await this.getInvite(userId, eventId))?.invite;
    if (!invite) {
      console.error(`Could not find invite for user ${userId} and event ${eventId}`);
      return;
    }

    const event = action === 'accept'
      ? await this.acceptInvitation(userId, eventId)
      : await this.declineInvitation(userId, eventId);
    if (!event) {
      console.error(`Could not find event for user ${userId} and event ${eventId}`);
      return;
    }

    const { blocks, text } = getResponseBlock(action, event.channelId, event.time);
    const userConversation = await this.slackRepository.openUserConversation(userId);
    const userChannelId = userConversation.channel?.id;
    if (!userChannelId) {
      console.error(`Could not open conversation with user ${userId} for event ${eventId}`);
      return;
    }
    await this.slackRepository.updateBlockMessage(
      userChannelId,
      blocks,
      text,
      invite.threadId!,
    );
    const events = await this.getUserEvents(userId);
    await this.slackService.refreshHomeScreen(userId, events);
  }

  private static async createInvites(users: string[]): Promise<Invite[]> {
    return users.map((user) => {
      const invite: Invite = {
        reminderSent: undefined,
        userId: user,
        inviteSent: undefined,
        threadId: undefined,
      };
      return invite;
    });
  }

  static sortByDate(events: Event[]) {
    events.sort((a, b) => {
      if (a.time < b.time) return -1;
      if (a.time > b.time) return 1;
      if (a.id < b.id) return -1;
      return 1;
    });
  }
}

export default EventService;
