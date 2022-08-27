export interface Invite {
  userId: string;
  inviteSent: Date | undefined;
  reminderSent: Date | undefined;
}

export interface Event {
  id: string;
  declined: string[];
  accepted: string[];
  invites: Invite[];
  reservationUser?: string;
  expenseUser?: string;

  announced: boolean;
  time: Date;
  channelId: string;
}

export const EventUtil = {
  invite: (ev: Event, userIds: string[]): Event => {
    if (userIds.some((userId) => EventUtil.isInvolved(ev, userId))) {
      throw new Error(`User with id ${userIds} is already involved in event ${ev.id}`);
    }

    const newInvites = userIds
      .filter((userId) => !EventUtil.isInvolved(ev, userId))
      .map((userId) => {
        const invite: Invite = {
          reminderSent: undefined,
          userId,
          inviteSent: undefined,
        };
        return invite;
      });

    return {
      ...ev,
      invites: ev.invites?.concat(newInvites) || newInvites,
    };
  },

  acceptEvent: (event: Event, userId: string): Event => {
    const newEvent = { ...event };
    newEvent.invites = event.invites.filter((invite) => invite.userId !== userId);
    newEvent.accepted.push(userId);
    return newEvent;
  },

  declineEvent: (event: Event, userId: string): Event => {
    const newEvent = { ...event };
    newEvent.invites = event.invites.filter((invite) => invite.userId !== userId);
    newEvent.declined.push(userId);
    return newEvent;
  },

  announceAndFinalize: (event: Event, reservationUser: string, expenseUser: string): Event => {
    const newEvent: Event = {
      ...event,
      reservationUser,
      expenseUser,
      announced: true,
    };
    return newEvent;
  },

  isInvolved: (ev: Event, userId: string) =>
    EventUtil.isInvited(ev, userId)
    || EventUtil.hasAccepted(ev, userId)
    || EventUtil.hasDeclined(ev, userId),

  isInvited: (ev: Event, userId: string) =>
    ev.invites.some((inv) => inv.userId === userId),

  hasAccepted: (ev: Event, userId: string) =>
    ev.accepted.includes(userId),

  hasDeclined: (ev: Event, userId: string) =>
    ev.declined.includes(userId),
};
