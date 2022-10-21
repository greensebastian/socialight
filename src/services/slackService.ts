import { Event, EventUtil, Invite } from '@models/event';
import SlackRepository from '@repositories/slackRepository';
import { SectionBlock } from '@slack/bolt';
import { IStateRepository } from 'core/interface';
import {
  getAnnouncementBlock,
  getEventCancelledBlock,
  getHomeBlock,
  getInvitationBlock,
  getOptedInBlock,
  getOptedOutBlock,
  getReminderText,
  getUserMd,
} from '../util/blocks';

class SlackService {
  private cachedAnnouncementChannelId: string | undefined = undefined;

  constructor(
    private slackRepository: SlackRepository,
    private stateRepository: IStateRepository,
  ) {}

  async sendInvite(invite: Invite, channelId: string, date: Date, eventId: string) {
    const message = getInvitationBlock(channelId, date, eventId);
    return this.slackRepository.sendBlocksToUser(
      invite.userId,
      message.blocks,
      message.text,
      invite.threadId,
    );
  }

  async sendReminder(invite: Invite, channelId: string, date: Date) {
    return this.slackRepository.sendMarkdownToUser(invite.userId, `${getReminderText(channelId, date)} ${getUserMd(invite.userId)}`, invite.threadId);
  }

  async sendAnnouncement(event: Event) {
    const users = await this.slackRepository.getUsersDetails(event.accepted);
    const userIds = users.map((user) => user.id!);

    const { blocks, text } = getAnnouncementBlock(
      userIds,
      event.reservationUser!,
      event.expenseUser!,
      event.time,
      event.channelId,
    );

    for (const userId of userIds) {
      await this.sendAnnouncementToUser(userId, blocks, text);
    }
    // Don't invite for now, requires "Channels/Manage permissions"
    // await this.ensureInvitedToAnnouncementChannel(userIds);
    await this.sendAnnouncementToAnnouncementChannel(blocks, text);
  }

  private async sendAnnouncementToAnnouncementChannel(blocks: SectionBlock[], text: string) {
    await this.slackRepository.sendBlocks(await this.announcementChannelId(), blocks, text);
  }

  private async sendAnnouncementToUser(userId: string, blocks: SectionBlock[], text: string) {
    await this.slackRepository.sendBlocksToUser(userId, blocks, text);
  }

  private async announcementChannelId() {
    if (!this.cachedAnnouncementChannelId) {
      this.cachedAnnouncementChannelId = (
        await this.slackRepository.getChannels()
      ).announcementsChannel?.id;
    }

    return this.cachedAnnouncementChannelId!;
  }

  private async ensureInvitedToAnnouncementChannel(userIds: string[]) {
    await this.slackRepository.inviteToChannel(userIds, await this.announcementChannelId());
  }

  async sendFailedEventNotifications(event: Event) {
    const { blocks, text } = getEventCancelledBlock(event.channelId, event.time);
    for (const invite of event.invites) {
      await this.slackRepository.sendBlocksToUser(invite.userId, blocks, text, invite.threadId);
    }
  }

  async sendOptedOut(userId: string) {
    const { blocks, text } = getOptedOutBlock();
    await this.slackRepository.sendBlocksToUser(userId, blocks, text);
  }

  async sendOptedIn(userId: string) {
    const { blocks, text } = getOptedInBlock();
    await this.slackRepository.sendBlocksToUser(userId, blocks, text);
  }

  async refreshHomeScreen(userId: string, events: Event[]) {
    const userOptedOut = (await this.stateRepository.getOptedOut()).includes(userId);

    const accepted = events.filter((ev) => EventUtil.hasAccepted(ev, userId));
    const declined = events.filter((ev) => EventUtil.hasDeclined(ev, userId));
    const invited = events.filter((ev) => EventUtil.isInvited(ev, userId));

    await this.slackRepository.publishHomeView(
      userId,
      getHomeBlock(userOptedOut, invited, accepted, declined).blocks,
    );
  }
}

export default SlackService;
