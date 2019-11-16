import { TagReport } from './TagReport';

type ZoneTransitionEvent = {
  report: TagReport;
  zone: { name: string; id: number };
};

export { ZoneTransitionEvent };
