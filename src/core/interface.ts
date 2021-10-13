import { Event } from '@models/event';

export interface IStateRepository {
  getOptedOut(): Promise<string[]>;

  setOptedOut(optedOut: string[]): Promise<void>;

  getEvents(): Promise<Event[]>;

  setEvents(events: Event[]): Promise<void>;
}
