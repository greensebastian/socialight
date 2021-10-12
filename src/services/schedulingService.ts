import SlackRepository from '@repositories/slackRepository';
import { Job, scheduleJob } from 'node-schedule';
import PlanningService from './planningService';

const EVERY_5_MIN = '*/5 * * * *';
const EVERY_1_MIN = '*/1 * * * *';

class SchedulingService {
  private running = false;

  private planningService: PlanningService;

  private slackRepository: SlackRepository;

  private pinger: Job | undefined;

  constructor(planningService: PlanningService, slackRepository: SlackRepository) {
    this.planningService = planningService;
    this.slackRepository = slackRepository;
  }

  public start(): Promise<void> {
    if (this.running) return Promise.resolve();

    this.pinger = scheduleJob(EVERY_1_MIN, async (fireDate) => {
      console.log(fireDate.toISOString());
    });

    this.running = true;
    return Promise.resolve();
  }

  public stop(): Promise<void> {
    if (!this.running) return Promise.resolve();

    this.pinger!.cancel();

    this.running = false;
    return Promise.resolve();
  }
}

export default SchedulingService;
