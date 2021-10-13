import { Event, Invite } from '@models/event';
import DateService from '@services/dateService';
import { Guid } from 'guid-typescript';
import { IStateRepository } from 'src/core/interface';

class EventService {
  constructor(
    private stateRepository: IStateRepository,
    private dateService: DateService,
  ) {}

  /**
   * Find all created events
   * @param expired if true, include previous events
   * @returns array of all events
   */
  async getAllEvents(expired: boolean = false): Promise<Event[]> {
    const events = await this.stateRepository.getEvents();
    return expired ? events : events.filter((event) => event.time > this.dateService.now());
  }

  /**
   * Find all events for a certain user
   * @param userId Id of user to find events for
   * @param expired if true, include previous events
   * @returns array of all events
   */
  async getUserEvents(userId: string, expired: boolean = false): Promise<Event[]> {
    const events = await this.getAllEvents(expired);
    const userEvents = events.filter((event) => event.invites.some((inv) => inv.userId === userId)
      || event.accepted.includes(userId)
      || event.declined.includes(userId));
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
  async acceptInvitation(
    userId: string, channelId: string | undefined = undefined,
  ): Promise<Event | undefined> {
    const events = await this.getAllEvents();
    const event = await this.findEventToRespondTo(events, userId, channelId);
    if (!event) return undefined;

    const userInvite = event.invites.find((invite) => invite.userId === userId);
    if (userInvite) {
      event.invites = event.invites.filter((invite) => invite.userId !== userId);
      event.accepted.push(userId);
      await this.stateRepository.setEvents(events);
      return event;
    }
    return undefined;
  }

  /**
   * Declines the first event the user is invited to
   * @param userId Slack ID of user to decline
   * @returns true if an invitation was successfully declined
   */
  async declineInvitation(
    userId: string, channelId: string | undefined = undefined,
  ): Promise<Event | undefined> {
    const events = await this.getAllEvents();
    const event = await this.findEventToRespondTo(events, userId, channelId);
    if (!event) return undefined;

    const userInvite = event.invites.find((invite) => invite.userId === userId);
    if (userInvite) {
      event.invites = event.invites.filter((invite) => invite.userId !== userId);
      event.declined.push(userId);
      await this.stateRepository.setEvents(events);
      return event;
    }
    return undefined;
  }

  async updateEvent(newEvent: Event) {
    const events = await this.getAllEvents();
    if (!events.find((ev) => ev.id === newEvent.id)) return;

    const updatedEvents = events.filter((event) => event.id !== newEvent.id);
    updatedEvents.push(newEvent);
    await this.stateRepository.setEvents(updatedEvents);
  }

  async inviteToEvent(event: Event, userIds: string[]) {
    event.invites.concat(await EventService.createInvites(userIds));
    await this.updateEvent(event);
  }

  private static async createInvites(users: string[]): Promise<Invite[]> {
    return users.map((user) => {
      const invite: Invite = {
        reminderSent: undefined,
        userId: user,
        inviteSent: undefined,
      };
      return invite;
    });
  }

  // eslint-disable-next-line class-methods-use-this
  private async findEventToRespondTo(
    events: Event[], userId: string, channelId: string | undefined,
  ): Promise<Event | undefined> {
    EventService.sortByDate(events);

    if (channelId) {
      return events.find((event) => event.channelId === channelId);
    }

    for (const event of events) {
      const userInvite = event.invites.find((invite) => invite.userId === userId);
      if (userInvite) {
        return event;
      }
    }

    return undefined;
  }

  static sortByDate(events: Event[]) {
    events.sort((a, b) => (a.time <= b.time ? -1 : 1));
  }
}

export default EventService;
