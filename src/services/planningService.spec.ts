/* eslint-disable @typescript-eslint/no-unused-vars */
import Config from '@models/config';
import { Event, EventUtil, Invite } from '@models/event';
import ConfigRepository from '@repositories/configRepository';
import SlackRepository from '@repositories/slackRepository';
import { IStateRepository } from 'core/interface';
import DateService from './dateService';
import EventService from './eventService';
import PlanningService from './planningService';
import RandomService from './randomService';
import SlackService from './slackService';

describe('PlanningService', () => {
  describe('fillInvites', () => {
    it('should not overfill', async () => {
      // Arrange
      const event: Event = {
        id: 'id',
        accepted: ['user1'],
        invites: [{
          inviteSent: new Date(),
          reminderSent: new Date(),
          threadId: 'threadId',
          userId: 'user2',
        }],
        declined: ['user3'],
        time: new Date('2040-01-01T12:00:00Z'),
        channelId: 'channelId',
      } as Event;

      let actualEvents: Event[] = [];
      const stateRepositoryMock: IStateRepository = {
        getEvents: () => Promise.resolve([event]),
        setEvents: (events) => {
          actualEvents = [...events];
          return Promise.resolve();
        },
        getOptedOut: () => Promise.resolve([] as string[]),
      } as IStateRepository;

      const slackRepositoryMock: SlackRepository = {
        getUsersInChannel: (_) => Promise.resolve(['user1', 'user2', 'user3', 'user4', 'user5', 'user6', 'user7', 'user8']),
        getUserDetails: (_) => Promise.resolve({ is_bot: false, is_app_user: false }),
      } as SlackRepository;

      const configRepositoryMock: ConfigRepository = {
        getConfig: () => Promise.resolve({ participants: 4 } as Config),
      } as ConfigRepository;

      const newUsers: string[] = [];
      let calledEvent = {} as Event;

      const eventServiceMock: EventService = {
        inviteToEvent: (ev, userIds) => {
          for (const userId of userIds) {
            newUsers.push(userId);
          }
          calledEvent = ev;
          return Promise.resolve(EventUtil.invite(ev, userIds));
        },
      } as EventService;

      const sut = new PlanningService(
        stateRepositoryMock,
        new DateService(),
        new RandomService(),
        slackRepositoryMock,
        configRepositoryMock,
        eventServiceMock,
        {} as SlackService,
      );

      // Act

      const actual = await sut.fillInvites(event);

      // Assert

      expect(actual).toBeTruthy();
      expect(actual!.accepted.length).toBe(1);
      expect(actual!.invites.length).toBe(3);
      expect(actual!.declined.length).toBe(1);
      expect(newUsers.length).toBe(2);
    });

    it('should not overfill here either', async () => {
      // Arrange
      const event: Event = {
        id: 'id',
        accepted: [] as string[],
        invites: [] as Invite[],
        declined: [] as string[],
        time: new Date('2040-01-01T12:00:00Z'),
        channelId: 'channelId',
      } as Event;

      let actualEvents: Event[] = [];
      const stateRepositoryMock: IStateRepository = {
        getEvents: () => Promise.resolve([event]),
        setEvents: (events) => {
          actualEvents = [...events];
          return Promise.resolve();
        },
        getOptedOut: () => Promise.resolve([] as string[]),
      } as IStateRepository;

      const slackRepositoryMock: SlackRepository = {
        getUsersInChannel: (_) => Promise.resolve(['user1', 'user2', 'user3', 'user4', 'user5', 'user6', 'user7', 'user8']),
        getUserDetails: (_) => Promise.resolve({ is_bot: false, is_app_user: false }),
      } as SlackRepository;

      const configRepositoryMock: ConfigRepository = {
        getConfig: () => Promise.resolve({ participants: 4 } as Config),
      } as ConfigRepository;

      const newUsers: string[] = [];
      let calledEvent = {} as Event;

      const eventServiceMock: EventService = {
        inviteToEvent: (ev, userIds) => {
          for (const userId of userIds) {
            newUsers.push(userId);
          }
          calledEvent = ev;
          return Promise.resolve(EventUtil.invite(ev, userIds));
        },
      } as EventService;

      const sut = new PlanningService(
        stateRepositoryMock,
        new DateService(),
        new RandomService(),
        slackRepositoryMock,
        configRepositoryMock,
        eventServiceMock,
        {} as SlackService,
      );

      // Act

      const actual = await sut.fillInvites(event);

      // Assert

      expect(actual).toBeTruthy();
      expect(actual!.accepted.length).toBe(0);
      expect(actual!.invites.length).toBe(4);
      expect(actual!.declined.length).toBe(0);
      expect(newUsers.length).toBe(4);
    });

    it('should not overfill here either either', async () => {
      // Arrange
      const event: Event = {
        id: 'id',
        accepted: [] as string[],
        invites: [{
          inviteSent: new Date(),
          reminderSent: new Date(),
          threadId: 'threadId',
          userId: 'user2',
        },
        {
          inviteSent: new Date(),
          reminderSent: new Date(),
          threadId: 'threadId',
          userId: 'user3',
        },
        {
          inviteSent: new Date(),
          reminderSent: new Date(),
          threadId: 'threadId',
          userId: 'user4',
        },
        {
          inviteSent: new Date(),
          reminderSent: new Date(),
          threadId: 'threadId',
          userId: 'user5',
        }],
        declined: [] as string[],
        time: new Date('2040-01-01T12:00:00Z'),
        channelId: 'channelId',
      } as Event;

      let actualEvents: Event[] = [];
      const stateRepositoryMock: IStateRepository = {
        getEvents: () => Promise.resolve([event]),
        setEvents: (events) => {
          actualEvents = [...events];
          return Promise.resolve();
        },
        getOptedOut: () => Promise.resolve([] as string[]),
      } as IStateRepository;

      const slackRepositoryMock: SlackRepository = {
        getUsersInChannel: (_) => Promise.resolve(['user1', 'user2', 'user3', 'user4', 'user5', 'user6', 'user7', 'user8']),
        getUserDetails: (_) => Promise.resolve({ is_bot: false, is_app_user: false }),
      } as SlackRepository;

      const configRepositoryMock: ConfigRepository = {
        getConfig: () => Promise.resolve({ participants: 4 } as Config),
      } as ConfigRepository;

      const newUsers: string[] = [];
      let calledEvent = {} as Event;

      const eventServiceMock: EventService = {
        inviteToEvent: (ev, userIds) => {
          for (const userId of userIds) {
            newUsers.push(userId);
          }
          calledEvent = ev;
          return Promise.resolve(EventUtil.invite(ev, userIds));
        },
      } as EventService;

      const sut = new PlanningService(
        stateRepositoryMock,
        new DateService(),
        new RandomService(),
        slackRepositoryMock,
        configRepositoryMock,
        eventServiceMock,
        {} as SlackService,
      );

      // Act

      const actual = await sut.fillInvites(event);

      // Assert

      expect(actual).toBeTruthy();
      expect(actual!.accepted.length).toBe(0);
      expect(actual!.invites.length).toBe(4);
      expect(actual!.declined.length).toBe(0);
      expect(newUsers.length).toBe(0);
    });
  });
});
