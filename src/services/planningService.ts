import DateService from '@services/dateService';
import dayjs from 'dayjs';
import RandomService from '@services/randomService';
import { Event } from '@models/event';
import { IStateRepository } from '../core/interface';
import SlackRepository from '../repositories/slackRepository';
import ConfigRepository from '../repositories/configRepository';
import EventService from './eventService';
import SlackService from './slackService';

class PlanningService {
  constructor(
    private stateRepository: IStateRepository,
    private dateService: DateService,
    private randomService: RandomService,
    private slackRepository: SlackRepository,
    private configRepository: ConfigRepository,
    private eventService: EventService,
    private slackService: SlackService,
  ) {}

  /**
   * Finds the next event for the selected channel
   * @param channelId Id of channel to get event for
   * @returns The next event for the selected channel
   */
  async getNextEvent(channelId: string): Promise<Event | undefined> {
    const events = await this.eventService.getAllEvents();
    const event = events.find((ev) => ev.channelId === channelId);

    return event;
  }

  /**
   * Creates a new event for the selected channel
   * @param channelId Id of channel to create event for
   * @returns The created event
   */
  async createEvent(channelId: string): Promise<Event> {
    const date = this.getNewEventTime();
    const userIds = await this.getUserIdsToInvite(channelId);
    const event = await this.eventService.createEvent(channelId, date, userIds);
    return event;
  }

  /**
   * Opts the provided user out of being picked for events
   * @param userId
   */
  async optOut(userId: string): Promise<Event[]> {
    const optedOut = await this.stateRepository.getOptedOut();
    if (!optedOut.includes(userId)) {
      await this.stateRepository.setOptedOut(optedOut.concat(userId));
      await this.refreshHomeScreen(userId);
    }
    return [];
  }

  /**
   * Opts the provided user in to being picked for events
   * @param userId
   */
  async optIn(userId: string) {
    const optedOut = await this.stateRepository.getOptedOut();
    if (optedOut.includes(userId)) {
      await this.stateRepository.setOptedOut(optedOut.filter((id) => id !== userId));
      await this.refreshHomeScreen(userId);
    }
  }

  private async refreshHomeScreen(userId: string) {
    const userEvents = await this.eventService.getUserEvents(userId);
    await this.slackService.refreshHomeScreen(userId, userEvents);
  }

  private getNewEventTime(): Date {
    const currentTime = this.dateService.now();
    const now = dayjs(currentTime.toUTCString());

    // Schedule two mondays away at the earliest
    const nextSunday = now.add(7 - now.day(), 'day');
    const mondayTwoWeeksOut = nextSunday.add(8, 'day');

    // Add 0-3 days to randomize monday through thursday
    const daysToAdd = this.randomService.getInt(4);
    const dayOfMeeting = mondayTwoWeeksOut.add(daysToAdd, 'day');
    // Normalize to 17:00
    return dayOfMeeting.startOf('day').add(17, 'hour').toDate();
  }

  /**
   * Expire events one day before they're supposed to start if not enough people have accepted
   * @returns Events which have been removed
   */
  async removeFailedEvents(): Promise<Event[]> {
    const events = await this.eventService.getAllEvents();
    const config = await this.configRepository.getConfig();
    const now = dayjs(this.dateService.now());

    const failedEvents: Event[] = [];
    const activeEvents: Event[] = [];

    for (const event of events) {
      const date = dayjs(event.time);
      const failed =
        !event.announced &&
        event.accepted.length < config.participants &&
        now.isAfter(date.subtract(1, 'day'));

      if (failed) failedEvents.push(event);
      else activeEvents.push(event);
    }

    await this.stateRepository.setEvents(activeEvents);

    return failedEvents;
  }

  async removeSingleEvent(event: Event) {
    const events = await this.eventService.getAllEvents();
    const activeEvents = events.filter((e) => e.id !== event.id);

    await this.stateRepository.setEvents(activeEvents);
  }

  async fillInvites(event: Event) {
    const userIds = await this.getUserIdsToInvite(event.channelId, event);
    await this.eventService.inviteToEvent(event, userIds);
  }

  private async getUserIdsToInvite(
    channelId: string,
    event: Event | undefined = undefined,
  ): Promise<string[]> {
    const optedOut = await this.stateRepository.getOptedOut();

    const pending = event?.invites?.map((invite) => invite.userId) || [];
    const accepted = event?.accepted || [];
    const declined = event?.declined || [];

    const usersInChannel = await this.slackRepository.getUsersInChannel(channelId);

    const usersToIgnore = [...pending, ...accepted, ...declined, ...optedOut];
    const availableToAdd = usersInChannel.filter((user) => !usersToIgnore.includes(user));
    const maxParticipants = (await this.configRepository.getConfig()).participants;

    this.randomService.shuffleArray(availableToAdd);

    const toInvite = new Set<string>();
    for (const userId of availableToAdd) {
      const userDetails = await this.slackRepository.getUserDetails(userId);
      if (!userDetails.is_app_user && !userDetails.is_bot && !toInvite.has(userId)) {
        toInvite.add(userId);
        if (toInvite.size >= maxParticipants) break;
      }
    }

    return Array.from(toInvite);
  }
}

export default PlanningService;
