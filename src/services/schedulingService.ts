import { Invite } from '@models/event';
import ConfigRepository from '@repositories/configRepository';
import SlackRepository from '@repositories/slackRepository';
import dayjs from 'dayjs';
import { Job, scheduleJob } from 'node-schedule';
import { logTrace } from 'server';
import DateService from './dateService';
import EventService from './eventService';
import PlanningService from './planningService';
import SlackService from './slackService';

// const EVERY_1_JAN = '0 0 12 1 1 ? *';
const EVERY_5_MIN = '*/5 * * * *';
// const EVERY_1_MIN = '*/1 * * * *';

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
  ) {}

  public start(): Promise<void> {
    if (this.running) return Promise.resolve();

    this.job = scheduleJob(EVERY_5_MIN, async (fireDate) => {
      console.log(`Running scheduler... ${(fireDate ?? this.dateService.now()).toISOString()}`);

      // Order of operations is important here
      await this.announceEvents();
      await this.removeFailedEvents();
      await this.planNewEvents();
      await this.expireOldInvites();
      await this.createNewInvites();
      await this.sendInvitesAndReminders();
      await this.cancelEventWithoutEnoughInvites();
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
    const events = await this.eventService.getAllEvents();
    const affectedUsers = new Set<string>();
    for (const event of events) {
      if (event.accepted.length === config.participants && !event.announced) {
        const finalizedEvent = await this.eventService.finalizeAndUpdateEvent(event);
        await this.slackService.sendAnnouncement(finalizedEvent);
        logTrace(event.id, 'announcing', '');
        for (const userId of event.accepted) {
          if (affectedUsers.has(userId)) affectedUsers.add(userId);
        }
      }
    }

    for (const userId of affectedUsers) {
      const userEvents = await this.eventService.getUserEvents(userId);
      await this.slackService.refreshHomeScreen(userId, userEvents);
    }
  }

  /**
   * Expire events one day before they're supposed to start if not enough people have accepted
   */
  private async removeFailedEvents() {
    const failedEvents = await this.planningService.removeFailedEvents();

    await Promise.all(
      failedEvents.map(async (event) => {
        await this.slackService.sendFailedEventNotifications(event);
      }),
    );
  }

  private async planNewEvents() {
    const channels = await this.slackRepository.getChannels();
    for (const channel of channels.poolChannels) {
      const event = await this.planningService.getNextEvent(channel.id!);
      if (!event) {
        logTrace('scheduled', 'createEvent', `${channel.id}, ${channel.name}`);
        await this.planningService.createEvent(channel.id!);
      }
    }
  }

  private async expireOldInvites() {
    const events = await this.eventService.getAllEvents();
    for (const event of events) {
      for (const invite of event.invites.filter(SchedulingService.shouldExpire)) {
        logTrace(invite.userId, 'expiring', 'expiring old invite');
        await this.eventService.handleUserAction('expire', invite.userId, event.id);
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
        const now = this.dateService.now();
        if (await this.shouldSendReminder(invite)) {
          await this.slackService.sendReminder(invite, event.channelId, event.time);
          invite.reminderSent = now;
          await this.eventService.updateEvent(event);
        }
        if (await this.shouldSendInvite(invite)) {
          const inviteMessageInfo = await this
            .slackService.sendInvite(invite, event.channelId, event.time, event.id);
          invite.inviteSent = now;
          invite.reminderSent = now;
          invite.threadId = inviteMessageInfo.ts;
          await this.eventService.updateEvent(event);
        }
      }
    }
  }

  private async cancelEventWithoutEnoughInvites() {
    const events = await this.eventService.getAllEvents();
    const maxParticipants = (await this.configRepository.getConfig()).participants;

    for (const event of events) {
      if (event.accepted.length + event.invites.length < maxParticipants) {
        logTrace('scheduler', 'failEvent', `Failing event ${event.id} for channel ${event.channelId}`);
        await this.planningService.removeSingleEvent(event);
        await this.slackService.sendFailedEventNotifications(event);
      }
    }
  }

  private async isInActiveHours(): Promise<boolean> {
    const config = await this.configRepository.getConfig();
    if (config.development) return true;

    const now = dayjs(this.dateService.now());
    const start = now.startOf('day').add(config.startOfDay, 'hour');
    const end = now.startOf('day').add(config.endOfDay, 'hour');
    return now.isAfter(start) && now.isBefore(end);
  }

  private async shouldSendInvite(invite: Invite): Promise<boolean> {
    return (await this.isInActiveHours()) && !invite.inviteSent;
  }

  private static shouldExpire(invite: Invite): boolean {
    return (
      !!invite.reminderSent &&
      dayjs(invite.inviteSent).add(1, 'day').isBefore(dayjs(invite.reminderSent))
    );
  }

  private async shouldSendReminder(invite: Invite): Promise<boolean> {
    const latestReminder = dayjs(invite.reminderSent || '1970-01-01');

    return (
      (await this.isInActiveHours()) &&
      !!invite.inviteSent &&
      latestReminder.isBefore(dayjs(this.dateService.now()).subtract(2, 'hour'))
    );
  }
}

export default SchedulingService;
