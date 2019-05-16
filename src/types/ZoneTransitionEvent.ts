import { Tag } from './Tag';

type ZoneTransitionEvent = {
  tag: Tag;
  zone: { name: string; id: number };
};

export { ZoneTransitionEvent };
