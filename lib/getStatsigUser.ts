import { StatsigUser } from 'statsig-node';
export default function getStatsigUser(user: StatsigUser | {} = {}) {
  return {
    customIDs: {
      sdk_type: 'azureai-nodejs',
    },
    ...user,
  }  
}