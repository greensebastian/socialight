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

  announced: boolean;
  time: Date;
  channelId: string;
}
