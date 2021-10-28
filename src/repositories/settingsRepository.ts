import SettingsGroup from '@models/settings';
import { existsSync, readFileSync } from 'fs';

const settingsPath = 'settings.json';

class SettingsRepository {
  private settingsGroups: SettingsGroup[];

  constructor() {
    if (!existsSync(settingsPath)) {
      throw new Error(`Cannot find settings file '${settingsPath}', exiting`);
    }
    const raw = readFileSync(settingsPath, 'utf-8')!;
    this.settingsGroups = JSON.parse(raw);
  }

  getSettings(): Promise<SettingsGroup[]> {
    return Promise.resolve(this.settingsGroups);
  }

  async getChannelSettings(channelName: string): Promise<SettingsGroup | undefined> {
    const all = await this.getSettings();
    return all.find((settings) => settings.channelNames.includes(channelName));
  }
}

export default SettingsRepository;
