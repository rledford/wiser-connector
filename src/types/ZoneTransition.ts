import { Tag } from './Tag';

type ZoneTransition = {
  type: number;
  tag: Tag;
  zone: { name: string; id: number };
};

export { ZoneTransition };
