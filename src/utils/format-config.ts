import { PinataConfig } from "../core/types";

export const formatConfig = (config: PinataConfig | undefined) => {
  let gateway = config?.pinataGateway;
  if (config && gateway) {
    if (gateway && !gateway.startsWith("https://")) {
      gateway = `https://${gateway}`;
    }
    config.pinataGateway = gateway;
  }
  return config;
};
