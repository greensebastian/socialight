export interface Config {
  poolChannel: string;
  announcementsChannel: string;
}

const getConfig: () => Promise<Config> = () => new Promise((resolve) => {
  const config: Config = {
    poolChannel: 'sgre-pizzalight-pool',
    announcementsChannel: 'sgre-pizzalight-announcements',
  };

  resolve(config);
});

export default getConfig;
