import type { PinataConfig } from '../../types';
import { PublicGateways, PrivateGateways } from './';
import { formatConfig } from '../../../utils/format-config';

export class Gateways {
  config: PinataConfig | undefined;
  public: PublicGateways;
  private: PrivateGateways;

  constructor(config?: PinataConfig) {
    this.config = formatConfig(config);
    this.public = new PublicGateways(config);
    this.private = new PrivateGateways(config);
  }

  updateConfig(newConfig: PinataConfig): void {
    this.config = newConfig;
  }
}
