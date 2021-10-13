import { Invite } from '@models/event';
import ConfigRepository from '@repositories/configRepository';
import SlackRepository from '@repositories/slackRepository';
import dayjs from 'dayjs';
import { Job, scheduleJob } from 'node-schedule';
import { IStateRepository } from 'src/core/interface';
import DateService from './dateService';
import EventService from './eventService';
import PlanningService from './planningService';
import SlackService from './slackService';

const EVERY_5_MIN = '*/5 * * * *';
const EVERY_1_MIN = '*/1 * * * *';

class SchedulingService {
  private running = false;

  private job: Job | undefined;

  constructor(
    private planningService: PlanningService,
    private slackRepository: SlackRepository,
    private eventService: EventService,
    private dateService: DateService,
    private slackService: SlackService,
    private configRepository: ConfigRepository,
    private stateRepository: IStateRepository,
  ) {}

  public start(): Promise<void> {
    if (this.running) return Promise.resolve();

    this.job = scheduleJob(EVERY_5_MIN, async (fireDate) => {
      console.log(`Running scheduler... ${(fireDate ?? this.dateService.now()).toISOString()}`);
      await this.announceEvents();
      await this.planNewEvents();
      await this.expireOldInvites();
      await this.createNewInvites();
      await this.sendInvitesAndReminders();
    });

    this.running = true;
    return Promise.resolve();
  }

  public stop(): Promise<void> {
    if (!this.running) return Promise.resolve();

    this.job!.cancel();

    this.running = false;
    return Promise.resolve();
  }

  public tick() {
    if (this.running) this.job?.invoke();
  }

  private async announceEvents() {
    const config = await this.configRepository.getConfig();
    const events = await this.stateRepository.getEvents();
    for (const event of events) {
      if (event.accepted.length === config.participants && !event.announced) {
        await this.slackService.sendAnnouncement(event);
        event.announced = true;
        await this.eventService.updateEvent(event);
      }
    }
  }

  private async planNewEvents() {
    const channels = await this.slackRepository.getChannels();
    for (const channel of channels.poolChannels) {
      const event = await this.planningService.getNextEvent(channel.id!);
      if (!event) await this.planningService.createEvent(channel.id!);
    }
  }

  private async expireOldInvites() {
    const events = await this.eventService.getAllEvents();
    for (const event of events) {
      for (const invite of event.invites.filter(SchedulingService.shouldExpire)) {
        await this.eventService.declineInvitation(invite.userId, event.channelId);
      }
    }
  }

  private async createNewInvites() {
    const events = await this.eventService.getAllEvents();
    for (const event of events) {
      await this.planningService.fillInvites(event);
    }
  }

  private async sendInvitesAndReminders() {
    const events = await this.eventService.getAllEvents();

    for (const event of events) {
      for (const invite of event.invites) {
        if (this.shouldSendReminder(invite)) {
          await this.slackService.sendReminder(invite, event.time);
          invite.reminderSent = this.dateService.now();
          await this.eventService.updateEvent(event);
        }
        if (SchedulingService.shouldSendInvite(invite)) {
          await this.slackService.sendInvite(invite, event.time);
          invite.inviteSent = this.dateService.now();
          await this.eventService.updateEvent(event);
        }
      }
    }
  }

  private static shouldSendInvite(invite: Invite): boolean {
    return !invite.inviteSent;
  }

  private static shouldExpire(invite: Invite): boolean {
    return !!invite.reminderSent && dayjs(invite.inviteSent).add(3, 'day').isBefore(dayjs(invite.reminderSent));
  }

  private shouldSendReminder(invite: Invite): boolean {
    const latestReminder = dayjs(invite.reminderSent || '1970-01-01');

    return !!invite.inviteSent && latestReminder.isBefore(dayjs(this.dateService.now()).subtract(1, 'day'));
  }
}

export default SchedulingService;
