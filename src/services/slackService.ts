import { Event, Invite } from '@models/event';
import SlackRepository from '@repositories/slackRepository';
import {
  getAnnouncementBlock,
  getEventCancelledBlock,
  getInvitationBlock,
  getOptedInBlock,
  getOptedOutBlock,
  getReminderBlock,
} from 'src/util/blocks';

class SlackService {
  private cachedAnnouncementChannelId: string | undefined = undefined;

  constructor(private slackRepository: SlackRepository) {}

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
    const { blocks, text } = getAnnouncementBlock(userIds, userIds[0], userIds[1], event.time);
    await this.slackRepository.sendBlocks(event.channelId, blocks, text);
  }

  private async announcementChannelId() {
    if (!this.cachedAnnouncementChannelId) {
      this.cachedAnnouncementChannelId = (
        await this.slackRepository.getChannels()
      ).announcementsChannel?.id;
    }

    return this.cachedAnnouncementChannelId!;
  }

  private async ensureInvitedToChannel(userIds: string[]) {
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
}

export default SlackService;
