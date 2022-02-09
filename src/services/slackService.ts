import { Event, Invite } from '@models/event';
import SlackRepository from '@repositories/slackRepository';
import {
  getAcceptErrorResponseBlock,
  getAcceptResponseBlock,
  getAnnouncementBlock,
  getDeclineErrorResponseBlock,
  getDeclineResponseBlock,
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

  async sendAcceptResult(event: Event | undefined, userId: string) {
    if (event == null) {
      const { blocks, text } = getAcceptErrorResponseBlock();
      await this.slackRepository.sendBlocksToUser(userId, blocks, text);
      return;
    }
    const { blocks, text } = getAcceptResponseBlock(event.channelId, event.time);
    await this.slackRepository.sendEphemeralBlocks(event.channelId, userId, blocks, text);
  }

  async sendDeclineResult(event: Event | undefined, userId: string) {
    if (event == null) {
      const { blocks, text } = getDeclineErrorResponseBlock();
      await this.slackRepository.sendBlocksToUser(userId, blocks, text);
      return;
    }
    const { blocks, text } = getDeclineResponseBlock(event.channelId, event.time);
    await this.slackRepository.sendEphemeralBlocks(event.channelId, userId, blocks, text);
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
