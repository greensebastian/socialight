import DateService from '@services/dateService';
import dayjs from 'dayjs';
import RandomService from '@services/randomService';
import { Event, Invite } from '@models/event';
import SlackRepository from '../repositories/slackRepository';
import ConfigRepository from '../repositories/configRepository';
import StateRepository from '../repositories/stateRepository';

class PlanningService {
  private stateRepository: StateRepository;

  private dateService: DateService;

  private randomService: RandomService;

  private slackRepository: SlackRepository;

  private configRepository: ConfigRepository;

  constructor(
    stateRepository: StateRepository,
    dateService: DateService,
    randomService: RandomService,
    slackRepository: SlackRepository,
    configRepository: ConfigRepository,
  ) {
    this.stateRepository = stateRepository;
    this.dateService = dateService;
    this.randomService = randomService;
    this.slackRepository = slackRepository;
    this.configRepository = configRepository;
  }

  /**
   * Finds or creates a new event for the selected channel
   * @param channelId Id of channel to get or create event for
   * @returns The next event for the selected channel
   */
  async getNextEvent(channelId: string): Promise<Event> {
    const events = await this.getAllEvents();
    const existingEvent = events.find((ev) => ev.channelId === channelId);

    if (existingEvent) return existingEvent;

    const inviteCandidates = await this.getNewInviteCandidates(channelId);
    const event: Event = {
      channelId,
      time: this.getTimeForNextEvent(),
      declined: [],
      accepted: [],
      invites: await PlanningService.createInvites(inviteCandidates),
    };

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
    userId: string, channelName: string | undefined = undefined,
  ): Promise<boolean> {
    const events = await this.getAllEvents();
    const event = await this.findEventToRespondTo(events, userId, channelName);
    if (!event) return false;

    const userInvite = event.invites.find((invite) => invite.userId === userId);
    if (userInvite) {
      event.invites = event.invites.filter((invite) => invite.userId !== userId);
      event.accepted.push(userId);
      await this.stateRepository.setEvents(events);
      return true;
    }
    return false;
  }

  /**
   * Declines the first event the user is invited to
   * @param userId Slack ID of user to decline
   * @returns true if an invitation was successfully declined
   */
  async declineInvitation(
    userId: string, channelName: string | undefined = undefined,
  ): Promise<boolean> {
    const events = await this.getAllEvents();
    const event = await this.findEventToRespondTo(events, userId, channelName);
    if (!event) return false;

    const userInvite = event.invites.find((invite) => invite.userId === userId);
    if (userInvite) {
      event.invites = event.invites.filter((invite) => invite.userId !== userId);
      event.declined.push(userId);
      await this.stateRepository.setEvents(events);
      return true;
    }
    return false;
  }

  /**
   * Opts the provided user out of being picked for events
   * @param userId
   */
  async optOut(userId: string) {
    const optedOut = await this.stateRepository.getOptedOut();
    if (!optedOut.includes(userId)) await this.stateRepository.setOptedOut(optedOut.concat(userId));
  }

  /**
   * Opts the provided user in to being picked for events
   * @param userId
   */
  async optIn(userId: string) {
    const optedOut = await this.stateRepository.getOptedOut();
    if (optedOut.includes(userId)) {
      await this.stateRepository.setOptedOut(optedOut.filter((id) => id !== userId));
    }
  }

  private async findEventToRespondTo(
    events: Event[], userId: string, channelName: string | undefined,
  ): Promise<Event | undefined> {
    PlanningService.sortByDate(events);

    if (channelName) {
      const channelId = await this.slackRepository.getChannel(channelName);
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

  private static sortByDate(events: Event[]) {
    events.sort((a, b) => (a.time <= b.time ? -1 : 1));
  }

  private async getAllEvents(expired: boolean = false) {
    const events = await this.stateRepository.getEvents();
    return expired ? events : events.filter((event) => event.time > this.dateService.now());
  }

  private getTimeForNextEvent(): Date {
    const currentTime = this.dateService.now();
    const now = dayjs(currentTime.toUTCString());

    // Dont schedule within 2 weeks
    const twoWeeksOut = now.add(8 - now.day(), 'day').add(7, 'day');
    // Add 0-3 days to randomize monday through thursday
    const daysToAdd = this.randomService.getInt(4);
    const dayOfMeeting = twoWeeksOut.add(daysToAdd, 'day');
    // Normalize to 17:00
    return dayOfMeeting.startOf('day').add(17, 'hour').toDate();
  }

  private static async createInvites(users: string[]): Promise<Invite[]> {
    return users.map((user) => {
      const invite: Invite = {
        nrOfTries: 0,
        userId: user,
        inviteSent: undefined,
      };
      return invite;
    });
  }

  private async getNewInviteCandidates(
    channelId: string, event: Event | undefined = undefined,
  ): Promise<string[]> {
    const optedOut = await this.stateRepository.getOptedOut();

    const pending = event?.invites?.map((invite) => invite.userId) || [];
    const accepted = event?.accepted || [];
    const declined = event?.declined || [];

    const usersInChannel = await this.slackRepository.getUsersInChannel(channelId);

    const usersToIgnore = [...pending, ...accepted, ...declined, ...optedOut];
    const availableToAdd = usersInChannel.filter((user) => !usersToIgnore.includes(user));
    const maxParticipants = (await this.configRepository.getConfig()).participants;

    return this.randomService.shuffleArray(availableToAdd).slice(0, maxParticipants);
  }
}

export default PlanningService;
