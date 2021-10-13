import { Event, Invite } from '@models/event';
import SlackRepository from '@repositories/slackRepository';

class SlackService {
  constructor(private slackRepository: SlackRepository) {}

  async sendInvite(invite: Invite, date: Date) {
    await this.slackRepository.sendMessage(invite.userId, `You've been invited to have pizza on ${date.toLocaleString()}!`);
  }

  async sendReminder(invite: Invite, date: Date) {
    await this.slackRepository.sendMessage(invite.userId, `Dont forget to respond to your invite to have pizza on ${date.toLocaleString()}!`);
  }

  async sendAnnouncement(event: Event) {
    await this.slackRepository.sendAnnouncement(`Successfully scheduled event! ${JSON.stringify(event)}`);
  }
}

export default SlackService;
