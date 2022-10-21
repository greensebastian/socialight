import { Event } from '@models/event';
import SlackRepository from '@repositories/slackRepository';
import { IStateRepository } from 'core/interface';
import DateService from './dateService';
import EventService from './eventService';
import RandomService from './randomService';
import SlackService from './slackService';

describe('EventService', () => {
  describe('finalizeAndUpdateEvent', () => {
    it('should finalize with only one accepted', async () => {
      // Arrange
      const mockEvents: Event[] = [
        {
          id: 'id',
          accepted: ['user1'],
          time: new Date('2040-01-01T12:00:00Z'),
        },
      ] as Event[];

      let actualEvents: Event[] = [];
      const stateRepositoryMock: IStateRepository = {
        getEvents: () => Promise.resolve(mockEvents),
        setEvents: (events) => {
          actualEvents = [...events];
          return Promise.resolve();
        },
      } as IStateRepository;
      const sut = new EventService(
        stateRepositoryMock,
        new DateService(),
        new RandomService(),
        {} as SlackService,
        {} as SlackRepository,
      );

      // Act

      const ev = (await sut.getAllEvents())[0];
      await sut.finalizeAndUpdateEvent(ev);

      // Assert

      expect(actualEvents.length).toBe(1);
      const actualEvent = actualEvents[0];
      expect(actualEvent.id).toBe('id');
      expect(actualEvent.reservationUser).toBe('user1');
      expect(actualEvent.expenseUser).toBe('user1');
    });
  });
});
