import { Event, Invite } from '@models/event';
import SlackRepository from '@repositories/slackRepository';
import { SectionBlock } from '@slack/bolt';
import { IStateRepository } from 'src/core/interface';
import {
  getAnnouncementBlock,
  getEventCancelledBlock,
  getHomeBlock,
  getInvitationBlock,
  getOptedInBlock,
  getOptedOutBlock,
  getReminderBlock,
} from '../util/blocks';

class SlackService {
  private cachedAnnouncementChannelId: string | undefined = undefined;

  constructor(
    private slackRepository: SlackRepository,
    private stateRepository: IStateRepository,
  ) {}

  async sendInvite(invite: Invite, channelId: string, date: Date) {
    const { blocks, text } = getInvitationBlock(channelId, date);
    await this.slackRepository.sendEphemeralBlocks(channelId, invite.userId, blocks, text);
  }

  async sendReminder(invite: Invite, channelId: string, date: Date) {
    const { blocks, text } = getReminderBlock(channelId, date);
    await this.slackRepository.sendEphemeralBlocks(channelId, invite.userId, blocks, text);
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

  async sendFailedEventNotification(event: Event) {
    const { blocks, text } = getEventCancelledBlock(event.channelId, event.time);
    await this.slackRepository.sendBlocks(event.channelId, blocks, text);
  }

  async sendOptedOut(userId: string) {
    const { blocks, text } = getOptedOutBlock();
    await this.slackRepository.sendBlocksToUser(userId, blocks, text);
  }

  async sendOptedIn(userId: string) {
    const { blocks, text } = getOptedInBlock();
    await this.slackRepository.sendBlocksToUser(userId, blocks, text);
  }

  async refreshHomeScreen(userId: string) {
    const userOptedOut = (await this.stateRepository.getOptedOut()).includes(userId);

    await this.slackRepository.publishHomeView(userId, getHomeBlock(userOptedOut).blocks);
  }
}

export default SlackService;
