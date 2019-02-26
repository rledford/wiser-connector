import { Adapter } from './Adapter';
import { Anchor } from './Anchor';
import { Gateway } from './Gateway';

type Arena = {
  panId: number;
  anchors: Anchor[];
  gateways: Gateway[];
  adapters: Adapter[];
};

export { Arena };
