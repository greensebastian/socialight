import { App, Block } from '@slack/bolt';
import { Channel } from '@slack/web-api/dist/response/ConversationsListResponse';
import { User } from '@slack/web-api/dist/response/UsersInfoResponse';
import { ConversationsOpenResponse, KnownBlock } from '@slack/web-api';
import ConfigRepository from './configRepository';

export type AuthorInfo = {
  username: string;
  // eslint-disable-next-line camelcase
  icon_emoji: string;
};

class SlackRepository {
  private cachedUsers = new Map<string, User>();

  private cachedChannels = new Map<string, Channel>();

  constructor(
    private configProvider: ConfigRepository,
    private slack: App,
    private botAuthorInfo: AuthorInfo,
  ) {}

  async getChannels() {
    const config = await this.configProvider.getConfig();

    let moreToFetch = true;
    let channels: Channel[] = [];
    let cursor: string | undefined;

    while (moreToFetch) {
      const conversationsResponse = await this.slack.client.conversations.list({
        types: 'public_channel,private_channel',
        exclude_archived: true,
        limit: 1000,
        cursor,
      });

      channels = channels.concat(conversationsResponse.channels!);
      cursor = conversationsResponse.response_metadata!.next_cursor;
      moreToFetch = !!cursor;
    }

    const poolChannelNames = config.poolChannels.split(',');
    const poolChannels = channels.filter((channel) => poolChannelNames.includes(channel.name!));
    const announcementsChannel = channels.find(
      (channel) => channel.name === config.announcementsChannel,
    );

    for (const channel of poolChannels) {
      this.cachedChannels.set(channel.id!, channel);
    }

    return { poolChannels, announcementsChannel };
  }

  async getChannelByName(name: string) {
    const channelName = name.toLowerCase();
    const config = await this.configProvider.getConfig();
    if (!config.poolChannels.includes(channelName)) return undefined;

    const cachedChannel = Array.from(this.cachedChannels.values()).find(
      (channel) => channel.name?.toLowerCase() === channelName,
    );
    if (cachedChannel) {
      return cachedChannel;
    }

    const channels = await this.getChannels();
    return channels.poolChannels.find((channel) => channel.name?.toLowerCase() === channelName);
  }

  async getChannelById(channelId: string): Promise<Channel | undefined> {
    if (!this.cachedChannels.has(channelId)) await this.getChannels();
    const channel = this.cachedChannels.get(channelId);
    return channel;
  }

  async getUsersInChannel(channelId: string): Promise<string[]> {
    const userIds = await this.getChannelMemberIds(channelId);

    return Array.from(userIds);
  }

  private async getChannelMemberIds(channelId: string) {
    let moreToFetch = true;
    const memberIds = new Set<string>();
    let cursor: string | undefined;

    while (moreToFetch) {
      const usersResponse = await this.slack.client.conversations.members({
        channel: channelId,
        limit: 1000,
        cursor,
      });

      usersResponse.members!.forEach((memberId: any) => memberIds.add(memberId));
      cursor = usersResponse.response_metadata!.next_cursor;
      moreToFetch = !!cursor;
    }

    return memberIds;
  }

  async getUserDetails(userId: string) {
    return (await this.getUsersDetails([userId]))[0];
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

    const userDetailsResponse = await Promise.all(
      nonCachedUserIds.map((userId) => this.slack.client.users.info({ user: userId })),
    );
    const userDetails = userDetailsResponse.map((res) => res.user!);

    userDetails.forEach((user) => {
      this.cachedUsers.set(user.id!, user);
    });

    return userDetails.concat(cachedUserIds.map((id) => this.cachedUsers.get(id)!));
  }

  private async openUserConversation(userId: string): Promise<ConversationsOpenResponse> {
    return this.slack.client.conversations.open({ users: userId });
  }

  async inviteToChannel(userIds: string[], channelId: string) {
    await this.slack.client.conversations.invite({
      channel: channelId,
      users: userIds.join(','),
    });
  }

  async sendMessage(userId: string, text: string) {
    const conversation = await this.openUserConversation(userId);
    await this.slack.client.chat.postMessage({
      channel: conversation.channel!.id!,
      text,
      // ...this.botAuthorInfo,
    });
  }

  async sendMarkdownToUser(userId: string, markdown: string) {
    const conversation = await this.openUserConversation(userId);
    await this.sendMarkdown(conversation.channel!.id!, markdown);
  }

  async sendBlocksToUser(userId: string, blocks: KnownBlock[], text: string) {
    const conversation = await this.openUserConversation(userId);
    await this.sendBlocks(conversation.channel!.id!, blocks, text);
  }

  public async sendMarkdown(channelId: string, markdown: string) {
    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: markdown,
        },
      },
    ];
    await this.slack.client.chat.postMessage({
      channel: channelId,
      blocks,
      text: markdown,
      // ...this.botAuthorInfo,
    });
  }

  async sendBlocks(channelId: string, blocks: KnownBlock[], text: string) {
    await this.slack.client.chat.postMessage({
      channel: channelId,
      blocks,
      text,
      // ...this.botAuthorInfo,
    });
  }

  async sendEphemeralBlocks(channelId: string, userId: string, blocks: KnownBlock[], text: string) {
    await this.slack.client.chat.postEphemeral({
      channel: channelId,
      user: userId,
      blocks,
      text,
      // ...this.botAuthorInfo,
    });
  }

  async publishHomeView(userId: string, blocks: Block[]) {
    // Call views.publish with the built-in client
    await this.slack.client.views.publish({
      // Use the user ID associated with the event
      user_id: userId,
      view: {
        // Home tabs must be enabled in your app configuration page under "App Home"
        type: 'home',
        blocks,
      },
    });
  }
}

export default SlackRepository;
