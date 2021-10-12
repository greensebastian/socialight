export interface Invite {
  userId: string;
  inviteSent: Date | undefined;
  nrOfTries: number;
}

export interface Event {
  declined: string[];
  accepted: string[];
  invites: Invite[];

  time: Date;
  channelId: string;
}
