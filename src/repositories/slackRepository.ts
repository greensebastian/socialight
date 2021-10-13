import { App } from '@slack/bolt';
import { Channel } from '@slack/web-api/dist/response/ConversationsListResponse';
import { User } from '@slack/web-api/dist/response/UsersInfoResponse';
import ConfigRepository from '@repositories/configRepository';
import { ConversationsOpenResponse } from '@slack/web-api';

class SlackRepository {
  private cachedUsers = new Map<string, User>();

  private cachedChannels = new Map<string, Channel>()

  constructor(private configProvider: ConfigRepository, private slack: App) {}

  async getChannels() {
    const config = await this.configProvider.getConfig();

    const conversationsResponse = await this.slack.client.conversations.list({ types: 'public_channel', exclude_archived: true, limit: 1000 });
    const poolChannelNames = config.poolChannels.split(',');
    const poolChannels = conversationsResponse.channels!
      .filter((channel) => poolChannelNames.includes(channel.name!));
    const announcementsChannel = conversationsResponse.channels!
      .find((channel) => channel.name === config.announcementsChannel);

    for (const channel of poolChannels) {
      this.cachedChannels.set(channel.id!, channel);
    }

    return { poolChannels, announcementsChannel };
  }

  async getChannel(name: string) {
    const channelName = name.toLowerCase();
    const config = await this.configProvider.getConfig();
    if (!config.poolChannels.includes(channelName)) return undefined;

    const cachedChannel = Array.from(this.cachedChannels.values())
      .find((channel) => channel.name?.toLowerCase() === channelName);
    if (cachedChannel) {
      return cachedChannel;
    }

    const channels = await this.getChannels();
    return channels.poolChannels.find((channel) => channel.name?.toLowerCase() === channelName);
  }

  async getUsersInChannel(channelId: string) {
    const userIds = await this.getChannelMemberIds(channelId);

    // We need to fetch all user details to ensure none of the users are bots
    const users = await this.getUsersDetails(Array.from(userIds));

    return users.map((user) => user.id!);
  }

  private async getChannelMemberIds(channelId: string) {
    let moreToFetch = true;
    const memberIds = new Set<string>();
    let cursor: string | undefined;

    while (moreToFetch) {
      const usersResponse = await this.slack.client.conversations
        .members({ channel: channelId, limit: 1000, cursor });

      usersResponse.members!.forEach((memberId) => memberIds.add(memberId));
      cursor = usersResponse.response_metadata!.next_cursor;
      moreToFetch = !!cursor;
    }

    return memberIds;
  }

  async getUsersDetails(userIds: string[]) {
    const nonCachedUserIds: string[] = [];
    const cachedUserIds: string[] = [];
    for (const userId of userIds) {
      if (this.cachedUsers.has(userId)) {
        cachedUserIds.push(userId);
      } else {
        nonCachedUserIds.push(userId);
      }
    }

    const userDetailsResponse = await Promise.all(nonCachedUserIds.map((userId) => this.slack.client
      .users.info({ user: userId })));
    const userDetails = userDetailsResponse
      .map((res) => res.user!)
      .filter((user) => !user.is_bot && !user.is_app_user);

    userDetails.forEach((user) => {
      this.cachedUsers.set(user.id!, user);
    });

    return userDetails.concat(cachedUserIds.map((id) => this.cachedUsers.get(id)!));
  }

  private async openUserConversation(userId: string): Promise<ConversationsOpenResponse> {
    return this.slack.client.conversations.open({ users: userId });
  }

  async sendMessage(userId: string, text: string) {
    const conversation = await this.openUserConversation(userId);
    await this.slack.client.chat.postMessage({ channel: conversation.channel!.id!, text });
  }

  async sendMarkdown(userId: string, markdown: string) {
    const blocks = [{
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: markdown,
      },
    }];
    const conversation = await this.openUserConversation(userId);
    await this.slack.client.chat.postMessage({
      channel: conversation.channel!.id!, blocks, text: markdown,
    });
  }

  async sendAnnouncement(text: string) {
    const channel = (await this.getChannels()).announcementsChannel;
    await this.slack.client.chat.postMessage({ channel: channel!.id!, text });
  }
}

export default SlackRepository;
