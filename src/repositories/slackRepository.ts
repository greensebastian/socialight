import { App, Block } from '@slack/bolt';
import { Channel } from '@slack/web-api/dist/response/ConversationsListResponse';
import { User } from '@slack/web-api/dist/response/UsersInfoResponse';
import ConfigRepository from '@repositories/configRepository';
import { ChatUpdateArguments, ConversationsOpenResponse, KnownBlock } from '@slack/web-api';
import { logTrace } from 'server';

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

  private async cacheChannelsFromSlack() {
    let moreToFetch = true;
    let channels: Channel[] = [];
    let cursor: string | undefined;

    while (moreToFetch) {
      logTrace('slackRepository', 'getChannels', 'getting new batch of available channels');
      const conversationsResponse = await this.slack.client.conversations.list({
        types: 'public_channel,private_channel',
        exclude_archived: true,
        limit: 1000,
        cursor,
      });
      logTrace('slackRepository', 'getChannels', `Retrieved ${conversationsResponse.channels?.length} channels in batch`);

      const newChannels = conversationsResponse.channels!;

      for (const channel of newChannels) {
        this.cachedChannels.set(channel.id!, channel);
      }

      channels = channels.concat(newChannels);
      cursor = conversationsResponse.response_metadata!.next_cursor;
      moreToFetch = !!cursor;
    }

    logTrace('slackRepository', 'getChannels', `Retrieved ${channels.length} channels`);

    return channels;
  }

  async getParticipatingChannels() {
    const config = await this.configProvider.getConfig();

    const participatingChannels = [];
    for (const channelNamePair of config.channels) {
      const poolChannel = await this.getChannelByName(channelNamePair.poolChannel);
      const announcementsChannel =
        await this.getChannelByName(channelNamePair.announcementsChannel);

      if (poolChannel && announcementsChannel) {
        participatingChannels.push({
          poolChannel,
          announcementsChannel,
        });
      }
    }

    return participatingChannels;
  }

  async getChannelByName(name: string) {
    const cachedChannel = await this.getCachedChannelByName(name);
    if (cachedChannel) {
      return cachedChannel;
    }
    await this.cacheChannelsFromSlack();

    return this.getCachedChannelByName(name);
  }

  private async getCachedChannelByName(name: string) {
    const channelName = name.toLowerCase();
    const config = await this.configProvider.getConfig();

    const activeChannelNames = config.channels
      .flatMap((channelPair) => [channelPair.poolChannel, channelPair.announcementsChannel]);
    if (!activeChannelNames.includes(channelName)) return undefined;

    return Array.from(this.cachedChannels.values()).find(
      (channel) => channel.name?.toLowerCase() === channelName.toLowerCase(),
    );
  }

  async getChannelById(channelId: string): Promise<Channel | undefined> {
    if (!this.cachedChannels.has(channelId)) await this.cacheChannelsFromSlack();
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
      logTrace('slackRepository', 'getChannelMemberIds', `listing members in channel ${channelId}`);
      const usersResponse = await this.slack.client.conversations.members({
        channel: channelId,
        limit: 1000,
        cursor,
      });
      logTrace('slackRepository', 'getChannelMemberIds', `Retrieved ${usersResponse.members?.length} users in batch`);

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

    if (nonCachedUserIds.length > 0) {
      logTrace('slackRepository', 'getUserDetails', `Getting user details for ${nonCachedUserIds.join(', ')}`);
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

  async openUserConversation(userId: string): Promise<ConversationsOpenResponse> {
    logTrace('slackRepository', 'openUserConversation', `Opening conversation with ${userId}`);
    return this.slack.client.conversations.open({ users: userId });
  }

  async inviteToChannel(userIds: string[], channelId: string) {
    logTrace('slackRepository', 'inviteToChannel', `Inviting ${userIds.join(', ')} to ${channelId}`);
    await this.slack.client.conversations.invite({
      channel: channelId,
      users: userIds.join(','),
    });
  }

  async sendMessage(userId: string, text: string) {
    const conversation = await this.openUserConversation(userId);
    logTrace('slackRepository', 'sendMessage', `Sending message to ${userId}`);
    await this.slack.client.chat.postMessage({
      channel: conversation.channel!.id!,
      text,
      // ...this.botAuthorInfo,
    });
  }

  async sendMarkdownToUser(userId: string, markdown: string, threadId: string = '') {
    const conversation = await this.openUserConversation(userId);
    return this.sendMarkdown(conversation.channel!.id!, markdown, threadId);
  }

  async updateBlockMessage(
    channelId: string,
    blocks: KnownBlock[],
    text: string,
    threadId: string,
  ) {
    const options: ChatUpdateArguments = {
      channel: channelId,
      blocks,
      text,
      ts: threadId,
    };
    await this.slack.client.chat.update(options);
  }

  async sendBlocksToUser(
    userId: string,
    blocks: KnownBlock[],
    text: string,
    threadId: string | undefined = undefined,
  ) {
    const conversation = await this.openUserConversation(userId);
    return this.sendBlocks(conversation.channel!.id!, blocks, text, threadId);
  }

  public async sendMarkdown(channelId: string, markdown: string, threadId: string) {
    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: markdown,
        },
      },
    ];

    logTrace('slackRepository', 'sendMarkdown', `Sending markdown on ${channelId} with thread id ${threadId}`);
    const resp = await this.slack.client.chat.postMessage({
      channel: channelId,
      blocks,
      text: markdown,
      thread_ts: threadId,
      // ...this.botAuthorInfo,
    });

    return resp.ts;
  }

  sendBlocks(
    channelId: string,
    blocks: KnownBlock[],
    text: string,
    threadId: string | undefined = undefined,
  ) {
    logTrace('slackRepository', 'sendBlocks', `Sending blocks on ${channelId} with thread id ${threadId}`);
    return this.slack.client.chat.postMessage({
      channel: channelId,
      blocks,
      text,
      thread_ts: threadId,
      // ...this.botAuthorInfo,
    });
  }

  async sendEphemeralBlocks(channelId: string, userId: string, blocks: KnownBlock[], text: string) {
    logTrace('slackRepository', 'sendEphemeralBlocks', `Sending ephemeral blocks to ${userId} on ${channelId}`);
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
    logTrace('slackRepository', 'publishHomeView', `Publishing home view for ${userId}`);
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
