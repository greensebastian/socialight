import dayjs from 'dayjs';
import { ActionsBlock, DividerBlock, SectionBlock } from '@slack/web-api';

const dateFormat = (date: Date) => {
  const d = dayjs(date);
  return d.format('dddd D MMMM, HH:mm');
};

const getChannelMd = (channelId: string) => `<#${channelId}>`;
const getUserMd = (userId: string) => `<@${userId}>`;
const getUsersMd = (userIds: string[]): string => {
  if (userIds.length === 2) return `${getUserMd(userIds[0])} and ${getUserMd(userIds[1])}`;
  if (userIds.length === 1) return getUserMd(userIds[0]);
  if (userIds.length === 0) return 'No one';
  const tail = userIds.slice(1);
  return `${getUserMd(userIds[0])}, ${getUsersMd(tail)}`;
};
const getDateMd = (date: Date) => `*${dateFormat(date)}*`;

const getInvitationText = (channelId: string, date: Date) =>
  `You've been invited to have pizza with ${getChannelMd(channelId)} on ${getDateMd(date)}`;
export const getInvitationBlock = (channelId: string, date: Date) => ({
  blocks: [
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: getInvitationText(channelId, date),
        },
      ],
    } as SectionBlock,
    {
      type: 'actions',
      block_id: 'actions',
      elements: [
        {
          type: 'button',
          style: 'primary',
          action_id: 'acceptInvite',
          text: {
            type: 'plain_text',
            text: 'Accept',
          },
        },
        {
          type: 'button',
          action_id: 'declineInvite',
          text: {
            type: 'plain_text',
            text: 'Decline',
          },
        },
      ],
    } as ActionsBlock,
  ],
  text: getInvitationText(channelId, date),
});

const getReminderText = (channelId: string, date: Date) =>
  `Reminder: You haven't responded to the invite to have pizza with ${getChannelMd(
    channelId,
  )} on ${getDateMd(date)}`;
export const getReminderBlock = (channelId: string, date: Date) => ({
  blocks: [
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: getReminderText(channelId, date),
        },
      ],
    } as SectionBlock,
    {
      type: 'actions',
      block_id: 'actions',
      elements: [
        {
          type: 'button',
          style: 'primary',
          action_id: 'accept',
          text: {
            type: 'plain_text',
            text: 'Accept',
          },
        },
        {
          type: 'button',
          action_id: 'decline',
          text: {
            type: 'plain_text',
            text: 'Decline',
          },
        },
      ],
    } as ActionsBlock,
  ],
  text: getReminderText(channelId, date),
});

export const getAnnouncementBlock = (
  userIds: string[],
  reservationUser: string,
  expenseUser: string,
  date: Date,
) => ({
  blocks: [
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `On ${getDateMd(date)}, ${getUsersMd(userIds)} will get together for pizza.
          
          ${getUserMd(reservationUser)} will make the reservation for the group.
          
          ${getUserMd(expenseUser)} will expense the pizza afterwards.

          The rest will show up and have a good time.`,
        },
      ],
    } as SectionBlock,
  ],
  text: `You're having pizza on ${getDateMd(date)}!`,
});

const getAcceptResponseText = (channelId: string, date: Date) =>
  `You've *accepted* the invite for pizza with ${getChannelMd(channelId)} on ${getDateMd(
    date,
  )}. Have fun!`;
export const getAcceptResponseBlock = (channelId: string, date: Date) => ({
  blocks: [
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: getAcceptResponseText(channelId, date),
        },
      ],
    } as SectionBlock,
  ],
  text: getAcceptResponseText(channelId, date),
});

const getDeclineResponseText = (channelId: string, date: Date) =>
  `You've *declined* the invite for pizza with ${getChannelMd(channelId)} on ${getDateMd(
    date,
  )}. Hope to see some other time!`;
export const getDeclineResponseBlock = (channelId: string, date: Date) => ({
  blocks: [
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `You've *declined* the invite for pizza with ${getChannelMd(
            channelId,
          )} on ${getDateMd(date)}. Hope to see some other time!`,
        },
      ],
    } as SectionBlock,
  ],
  text: getDeclineResponseText(channelId, date),
});

const getEventCancelledText = (channelId: string, date: Date) =>
  `The event planned for ${getChannelMd(channelId)} on ${getDateMd(
    date,
  )} was cancelled due to not enough people accepting the invite. :cry:`;
export const getEventCancelledBlock = (channelId: string, date: Date) => ({
  blocks: [
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: getEventCancelledText(channelId, date),
        },
      ],
    } as SectionBlock,
  ],
  text: getEventCancelledText(channelId, date),
});

const optedOutText =
  "Got it! You won't receive any more invites. You can always opt-in by typing /socialight";
export const getOptedOutBlock = () => ({
  blocks: [
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: optedOutText,
        },
      ],
    } as SectionBlock,
  ],
  text: optedOutText,
});

const optedInText =
  'Welcome back! You will now receive invites again. You can always opt-out by typing /socialight';
export const getOptedInBlock = () => ({
  blocks: [
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: optedInText,
        },
      ],
    } as SectionBlock,
  ],
  text: optedInText,
});

export const getInfoBlock = (optedOut: boolean) => ({
  blocks: [
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: 'Hi there!',
        },
      ],
    } as SectionBlock,
    {
      type: 'divider',
    } as DividerBlock,
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: optedOut
          ? "You're currently opted out of future events. You can opt-in here."
          : 'Too many invitations? You can opt-out of all future events. You can always opt-in again by typing */socialight.*',
      },
    } as SectionBlock,
    {
      type: 'actions',
      elements: [
        optedOut
          ? {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Opt-in',
            },
            action_id: 'optIn',
          }
          : {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Opt-out',
            },
            action_id: 'optOut',
          },
      ],
    } as ActionsBlock,
  ],
  text: '',
});

const acceptErrorResponseText =
  'Something went wrong while trying to accept an event :exploding_head:';
export const getAcceptErrorResponseBlock = () => ({
  blocks: [
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: acceptErrorResponseText,
        },
      ],
    } as SectionBlock,
  ],
  text: acceptErrorResponseText,
});

const declineErrorResponseText =
  'Something went wrong while trying to decline an event :exploding_head:';
export const getDeclineErrorResponseBlock = () => ({
  blocks: [
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: declineErrorResponseText,
        },
      ],
    } as SectionBlock,
  ],
  text: declineErrorResponseText,
});
