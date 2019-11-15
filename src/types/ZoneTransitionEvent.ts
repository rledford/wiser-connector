import { Tag } from './Tag';

type ZoneTransitionEvent = {
  report: Tag;
  zone: { name: string; id: number };
};

export { ZoneTransitionEvent };
