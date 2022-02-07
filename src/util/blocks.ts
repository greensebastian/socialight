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

export const getInvitationBlock = (channelId: string, date: Date) => ({
  blocks: [
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `You've been invited to have pizza with ${getChannelMd(channelId)} on ${getDateMd(
            date,
          )}`,
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
});

export const getReminderBlock = (channelId: string, date: Date) => ({
  blocks: [
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `Reminder: You haven't responded to the invite to have pizza with ${getChannelMd(
            channelId,
          )} on ${getDateMd(date)}`,
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
});

export const getAcceptResponseBlock = (channelId: string, date: Date) => ({
  blocks: [
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `You've *accepted* the invite for pizza with ${getChannelMd(
            channelId,
          )} on ${getDateMd(date)}. Have fun!`,
        },
      ],
    } as SectionBlock,
  ],
});

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
});

export const getEventCancelledBlock = (channelId: string, date: Date) => ({
  blocks: [
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `The event planned for ${getChannelMd(channelId)} on ${getDateMd(
            date,
          )} was cancelled due to not enough people accepting the invite. :cry:`,
        },
      ],
    } as SectionBlock,
  ],
});

export const getOptedOutBlock = () => ({
  blocks: [
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: "Got it! You won't receive any more invites. You can always opt-in by typing /socialight",
        },
      ],
    } as SectionBlock,
  ],
});

export const getOptedInBlock = () => ({
  blocks: [
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: 'Welcome back! You will now receive invites again. You can always opt-out by typing /socialight',
        },
      ],
    } as SectionBlock,
  ],
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
});
