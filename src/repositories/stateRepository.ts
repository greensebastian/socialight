import { Event } from '@models/event';

const KEY_EVENTS = 'EVENTS';
const KEY_OPT_OUT = 'OPT_OUT';

class StateRepository {
  private store = new Map<string, string>();

  private parsers = new Map<string, Function | null>();

  private set<T>(
    key: string,
    val: any,
    parser: ((stored: string) => T) | undefined = undefined,
  ): Promise<void> {
    this.store.set(key, JSON.stringify(val));
    if (parser) {
      this.parsers.set(key, parser);
    }
    return Promise.resolve();
  }

  private get<T>(key: string): Promise<T | undefined> {
    const val = this.store.get(key);
    if (!val) return Promise.resolve(undefined);

    const parser = this.parsers.get(key);
    return parser ? parser(val) : JSON.parse(val);
  }

  async getOptedOut() {
    return await this.get<string[]>(KEY_OPT_OUT) || [];
  }

  async setOptedOut(optedOut: string[]) {
    await this.set(KEY_OPT_OUT, optedOut);
  }

  async getEvents() {
    return await this.get<Event[]>(KEY_EVENTS) || [];
  }

  async setEvents(events: Event[]) {
    const parser = (serializedEvents: string): Event[] => {
      const parsed = JSON.parse(serializedEvents) as Event[];
      for (const event of parsed) {
        event.time = new Date(event.time);
        for (const invite of event.invites) {
          invite.inviteSent = invite.inviteSent ? new Date(invite.inviteSent) : invite.inviteSent;
        }
      }
      return parsed;
    };
    return this.set(KEY_EVENTS, events, parser);
  }
}

export default StateRepository;
