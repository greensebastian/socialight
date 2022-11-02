export type ParticipatingChannelPair = {
  poolChannel: string;
  announcementsChannel: string;
}

interface Config {
  channels: ParticipatingChannelPair[];
  participants: number;
  development: boolean;
  startOfDay: number;
  endOfDay: number;
}

export default Config;
