import Config, { ParticipatingChannelPair } from '@models/config';
import { readFileSync } from 'fs';

const APP_CONFIG_FILE_PATH = 'appconfig.json';

class ConfigRepository {
  private config: Config;

  constructor() {
    const appConfig = ConfigRepository.parseAppConfig();

    this.config = {
      channels: appConfig.channels,
      participants: Number(process.env.PARTICIPANTS),
      development: process.env.DEVELOPMENT === 'true',
      startOfDay: Number(process.env.START_OF_DAY) ?? 6,
      endOfDay: Number(process.env.END_OF_DAY) ?? 20,
    };
  }

  getConfig(): Promise<Config> {
    return Promise.resolve(this.config);
  }

  getAnnouncementsChannelForPoolChannel(poolChannelName: string): string {
    return this.config.channels
      .find((c) => c.poolChannel === poolChannelName)?.announcementsChannel!;
  }

  private static parseAppConfig() {
    const val = readFileSync(APP_CONFIG_FILE_PATH, 'utf-8');
    const appConfig = JSON.parse(val);

    const channels: ParticipatingChannelPair[] = [];

    if (Array.isArray(appConfig.channels)) {
      for (const channelPair of appConfig.channels) {
        if (channelPair.poolChannel && channelPair.announcementsChannel) {
          channels.push({
            poolChannel: `${channelPair.poolChannel}`,
            announcementsChannel: `${channelPair.announcementsChannel}`,
          });
        } else {
          throw new Error(`Invalid channel config:\n${JSON.stringify(channelPair)}`);
        }
      }
    }

    return {
      channels,
    };
  }
}

export default ConfigRepository;
