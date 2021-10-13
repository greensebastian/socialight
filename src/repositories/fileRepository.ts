import { Event } from '@models/event';
import { IStateRepository } from 'src/core/interface';
import { existsSync, readFileSync, writeFileSync } from 'fs';

const KEY_EVENTS = 'EVENTS';
const KEY_OPT_OUT = 'OPT_OUT';

const file = (key: string) => `state/${key}.json`;

class FileRepository implements IStateRepository {
  private parsers = new Map<string, Function | null>();

  private async set<T>(
    key: string,
    val: any,
    parser: ((stored: string) => T) | undefined = undefined,
  ): Promise<void> {
    writeFileSync(file(key), JSON.stringify(val), 'utf-8');
    if (parser) {
      this.parsers.set(key, parser);
    }
    return Promise.resolve();
  }

  private async get<T>(key: string): Promise<T | undefined> {
    const fileName = file(key);
    if (!existsSync(fileName)) {
      console.log(`No file named ${fileName} exists.`);
      return Promise.resolve(undefined);
    }
    const val = readFileSync(file(key), 'utf-8');
    if (!val) return Promise.resolve(undefined);

    const parser = this.parsers.get(key);
    return parser ? parser(val) : JSON.parse(val);
  }

  async getOptedOut(): Promise<string[]> {
    return await this.get<string[]>(KEY_OPT_OUT) || [];
  }

  async setOptedOut(optedOut: string[]): Promise<void> {
    await this.set(KEY_OPT_OUT, optedOut);
  }

  async getEvents(): Promise<Event[]> {
    return await this.get<Event[]>(KEY_EVENTS) || [];
  }

  async setEvents(events: Event[]): Promise<void> {
    const parser = (serializedEvents: string): Event[] => {
      const parsed = JSON.parse(serializedEvents) as Event[];
      for (const event of parsed) {
        event.time = new Date(event.time);
        for (const invite of event.invites) {
          invite.inviteSent = invite.inviteSent
            ? new Date(invite.inviteSent)
            : invite.inviteSent;
          invite.reminderSent = invite.reminderSent
            ? new Date(invite.reminderSent)
            : invite.reminderSent;
        }
      }
      return parsed;
    };
    return this.set(KEY_EVENTS, events, parser);
  }
}

export default FileRepository;
