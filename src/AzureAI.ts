import Statsig, { StatsigOptions } from "statsig-node";

import { ModelClient } from "./ModelClient";
import { getStatsigUser } from "./getStatsigUser";

export abstract class AzureAI {
  public static async initialize(
    statsigServerKey: string,
    options?: StatsigOptions
  ) {
    return await Statsig.initialize(statsigServerKey, options);
  }

  public static getModelClientFromEndpoint(
    apiEndpoint: string,
    apiKey: string
  ) {
    return new ModelClient(apiEndpoint, apiKey);
  }

  public static getModelClient(
    dynamicConfigName: string,
    defaultEndpoint?: string,
    defaultKey?: string
  ) {
    const config = Statsig.getConfigSync(getStatsigUser(), dynamicConfigName);
    const endpoint = config.get("endpoint", defaultEndpoint);
    const apiKey = config.get("key", defaultKey);
    const completionDefaults = config.get("completion_defaults", {});

    if (!endpoint || !apiKey) {
      const msg =
        "Invalid configuration for AzureAI.  API will return defaults.";
      throw new Error(msg);
    }
    return new ModelClient(endpoint, apiKey, completionDefaults);
  }

  public static getStatsigServer() {
    return Statsig;
  }

  public static async shutdown() {
    return await Statsig.shutdown();
  }
}
