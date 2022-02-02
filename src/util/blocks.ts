import dayjs from 'dayjs';

const dateFormat = (date: Date) => {
  const d = dayjs(date);
  return d.format('dddd D MMMM, HH:mm');
};

const getChannelMd = (channelId: string) => `<#${channelId}>`;
const getUserMd = (userId: string) => `<@${userId}>`;
const getUsersMd = (userIds: string[]): string => {
  if (userIds.length === 2) return `${getUserMd(userIds[0])} and ${getUserMd(userIds[1])}`;
  if (userIds.length === 1) return getUserMd(userIds[0]);
  const tail = userIds.slice(1);
  return `${getUserMd(userIds[0])}, ${getUsersMd(tail)}`;
};
const getDateMd = (date: Date) => `*${dateFormat(date)}*`;

export const getInviteBlock = (channelId: string, date: Date) => ({
  blocks: [
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `You've been invited to have pizza with ${getChannelMd(channelId)} on ${getDateMd(date)}`,
        },
      ],
    },
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
    },
  ],
});

export const getReminderBlock = (channelId: string, date: Date) => ({
  blocks: [
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `Reminder: You haven't responded to the invite to have pizza with ${getChannelMd(channelId)} on ${getDateMd(date)}`,
        },
      ],
    },
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
    },
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
    },
  ],
});
