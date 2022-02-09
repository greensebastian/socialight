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
  reservationUser: string | undefined;
  expenseUser: string | undefined;

  announced: boolean;
  time: Date;
  channelId: string;
}
