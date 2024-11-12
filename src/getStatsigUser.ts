import { StatsigUser } from "statsig-node";
export function getStatsigUser(user: StatsigUser | {} = {}) {
  return {
    customIDs: {
      sdk_type: "azureai-nodejs",
    },
    ...user,
  };
}
