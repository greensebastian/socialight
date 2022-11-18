import { Event, EventUtil, Invite } from '@models/event';
import ConfigRepository from '@repositories/configRepository';
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
  private announcementChannelIdsByPoolChannelIdsCache = new Map<string, string>();

  constructor(
    private slackRepository: SlackRepository,
    private stateRepository: IStateRepository,
    private configRepository: ConfigRepository,
  ) { }

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
    await this.sendAnnouncementToAnnouncementChannel(event.channelId, blocks, text);
  }

  private async sendAnnouncementToAnnouncementChannel(
    poolChannelId: string,
    blocks: SectionBlock[],
    text: string,
  ) {
    const announcementChannel = await this.announcementChannelId(poolChannelId);
    await this.slackRepository
      .sendBlocks(announcementChannel, blocks, text);
  }

  private async sendAnnouncementToUser(userId: string, blocks: SectionBlock[], text: string) {
    await this.slackRepository.sendBlocksToUser(userId, blocks, text);
  }

  private async announcementChannelId(poolChannelId: string) {
    if (!this.announcementChannelIdsByPoolChannelIdsCache.has(poolChannelId)) {
      const channelPairs = await this.slackRepository.getParticipatingChannels();
      const channelPair = channelPairs.find((pair) => pair.poolChannel.id === poolChannelId);
      const announcementsChannel = channelPair?.announcementsChannel;
      if (announcementsChannel?.id) {
        this.announcementChannelIdsByPoolChannelIdsCache
          .set(poolChannelId, announcementsChannel.id);
      }
    }

    return this.announcementChannelIdsByPoolChannelIdsCache.get(poolChannelId)!;
  }

  private async ensureInvitedToAnnouncementChannel(
    poolChannelId: string,
    userIds: string[],
  ) {
    await this.slackRepository
      .inviteToChannel(userIds, await this.announcementChannelId(poolChannelId));
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
