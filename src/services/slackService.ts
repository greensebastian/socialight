import { Event, Invite } from '@models/event';
import SlackRepository from '@repositories/slackRepository';
import {
  getAcceptResponseBlock,
  getAnnouncementBlock,
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
    const { blocks } = getInvitationBlock(channelId, date);
    await this.slackRepository.sendBlocksToUser(invite.userId, blocks);
  }

  async sendReminder(invite: Invite, channelId: string, date: Date) {
    const { blocks } = getReminderBlock(channelId, date);
    await this.slackRepository.sendBlocksToUser(invite.userId, blocks);
  }

  async sendAnnouncement(event: Event) {
    const users = await this.slackRepository.getUsersDetails(event.accepted);
    const userIds = users.map((user) => user.id!);
    const { blocks } = getAnnouncementBlock(userIds, userIds[0], userIds[1], event.time);
    await this.slackRepository.sendBlocks(event.channelId, blocks);
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

  async sendAcceptResult(event: Event, userId: string) {
    const { blocks } = getAcceptResponseBlock(event.channelId, event.time);
    await this.slackRepository.sendEphemeralBlocks(event.channelId, userId, blocks);
  }

  async sendDeclineResult(event: Event, userId: string) {
    const { blocks } = getDeclineResponseBlock(event.channelId, event.time);
    await this.slackRepository.sendEphemeralBlocks(event.channelId, userId, blocks);
  }

  async sendFailedEventNotification(event: Event) {
    const { blocks } = getEventCancelledBlock(event.channelId, event.time);
    await this.slackRepository.sendBlocks(event.channelId, blocks);
  }

  async sendOptedOut(userId: string) {
    const { blocks } = getOptedOutBlock();
    await this.slackRepository.sendBlocksToUser(userId, blocks);
  }

  async sendOptedIn(userId: string) {
    const { blocks } = getOptedInBlock();
    await this.slackRepository.sendBlocksToUser(userId, blocks);
  }
}

export default SlackService;
