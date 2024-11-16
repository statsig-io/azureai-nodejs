# Statsig Azure AI

Azure AI library with a built-in Statsig SDK.

Statsig helps you move faster with Feature Gates (Feature Flags) and Dynamic Configs. It also allows you to run A/B tests to validate your new features and understand their impact on your KPIs. If you're new to Statsig, create an account at [statsig.com](https://www.statsig.com).

More docs are available at: https://statsig.com/azureai-docs

## Getting Started

1. Install the library `npm install @statsig/azure-ai`
2. Initialize the main AzureAI interface along with the internal Statsig service

```ts
import { AzureAI, StatsigOptions } from "@statsig/azure-ai";

const options: StatsigOptions = {
  environment: { tier: "development" },
};

await AzureAI.initialize(<STATSIG_SERVER_KEY>, options);
```

3. Create the AzureAI inference client

```ts
const client = AzureAI.getModelClientFromEndpoint(
    <DEPLOYMENT_ENDPOINT_URL>,
    <DEPLOYMENT_KEY>
);
```

Optionally, use a Statsig Dynamic Config to provide default configurations

```ts
const client = AzureAI.getModelClient("azureai_model");
```

4. Call the API

```ts
const response = await client.complete([
  {
    role: "system",
    content: "You are a helpful assistant. You will talk like a pirate.",
  },
  { role: "user", content: "Can you help me?" },
]);
```

## References

- Statsig SDK [documentation](https://docs.statsig.com/server/nodejsServerSDK/)
