import { Tag } from './Tag';

type ZoneTransition = {
  type: string;
  tag: Tag;
  zone: { name: string; id: number };
};

export { ZoneTransition };
