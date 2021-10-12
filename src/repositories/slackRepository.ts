import { App } from '@slack/bolt';
import { Channel } from '@slack/web-api/dist/response/ConversationsListResponse';
import { User } from '@slack/web-api/dist/response/UsersInfoResponse';
import ConfigRepository from '@repositories/configRepository';

class SlackRepository {
  private configProvider: ConfigRepository;

  private slack: App;

  private cachedUsers = new Map<string, User>();

  private cachedChannels = new Map<string, Channel>()

  constructor(configProvider: ConfigRepository, slack: App) {
    this.configProvider = configProvider;
    this.slack = slack;
  }

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

    return Array.from(userIds);
  }

  private async getChannelMemberIds(channelId: string) {
    let moreToFetch = true;
    const memberIds = new Set<string>();
    let cursor: string | undefined;

    while (moreToFetch) {
      // eslint-disable-next-line no-await-in-loop
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
      .filter((user) => !user.is_bot);

    userDetails.forEach((user) => {
      this.cachedUsers.set(user.id!, user);
    });

    return userDetails.concat(cachedUserIds.map((id) => this.cachedUsers.get(id)!));
  }
}

export default SlackRepository;
