import Config from '@models/config';

class ConfigRepository {
  private config: Config;

  constructor() {
    this.config = {
      poolChannels: process.env.POOL_CHANNELS!,
      announcementsChannel: process.env.ANNOUNCEMENTS_CHANNEL!,
      participants: Number(process.env.PARTICIPANTS),
      development: process.env.DEVELOPMENT === 'true',
    };
  }

  getConfig(): Promise<Config> {
    return Promise.resolve(this.config);
  }
}

export default ConfigRepository;
