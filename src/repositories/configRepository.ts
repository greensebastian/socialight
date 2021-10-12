import Config from '@models/config';

class ConfigRepository {
  private config: Config = {
    poolChannels: 'sgre-pizzalight-pool',
    announcementsChannel: 'sgre-pizzalight-announcements',
    participants: 1,
  };

  getConfig(): Promise<Config> {
    return Promise.resolve(this.config);
  }
}

export default ConfigRepository;
