import DateService from '@services/dateService';
import dayjs from 'dayjs';
import RandomService from '@services/randomService';
import { Event } from '@models/event';
import { IStateRepository } from 'src/core/interface';
import SlackRepository from '../repositories/slackRepository';
import ConfigRepository from '../repositories/configRepository';
import EventService from './eventService';

class PlanningService {
  constructor(
    private stateRepository: IStateRepository,
    private dateService: DateService,
    private randomService: RandomService,
    private slackRepository: SlackRepository,
    private configRepository: ConfigRepository,
    private eventService: EventService,
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

  private getNewEventTime(): Date {
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

  async fillInvites(event: Event) {
    const userIds = await this.getUserIdsToInvite(event.channelId, event);
    await this.eventService.inviteToEvent(event, userIds);
  }

  private async getUserIdsToInvite(
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
