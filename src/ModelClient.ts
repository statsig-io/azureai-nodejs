import { EventMessage, createSseStream } from "@azure/core-sse";
import {
  HttpBrowserStreamResponse,
  HttpNodeStreamResponse,
  PathUncheckedResponse,
} from "@azure-rest/core-client";
import Statsig, { StatsigUser } from "statsig-node";
import createClient, * as AzInf from "@azure-rest/ai-inference";

import { AzureKeyCredential } from "@azure/core-auth";
import { ObservableEventStream } from "./ObservableEventStream";
import { getStatsigUser } from "./getStatsigUser";

export type StreamableMethod<TResponse = PathUncheckedResponse> =
  PromiseLike<TResponse> & {
    asNodeStream: () => Promise<HttpNodeStreamResponse>;
    asBrowserStream: () => Promise<HttpBrowserStreamResponse>;
  };

export type CompletionOptions = {
  frequency_penalty?: number;
  presence_penalty?: number;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stop?: string[];
  seed?: number;
  model?: string;
};

export type EmbeddingsOptions = {
  dimensions?: number;
  encoding_format?: string;
  input_type?: string;
  model?: string;
};

type InvokeContext = {
  invokeTime: number;
};

export class ModelClient {
  private apiEndpoint: string;
  private apiKey: string;
  private azureClient: AzInf.ModelClient;
  private completionDefaults: Partial<CompletionOptions>;

  constructor(
    apiEndpoint: string,
    apiKey: string,
    completionDefaults: Partial<CompletionOptions> = {}
  ) {
    this.apiEndpoint = apiEndpoint;
    this.apiKey = apiKey;
    this.completionDefaults = completionDefaults;
    this.azureClient = createClient(
      apiEndpoint,
      new AzureKeyCredential(apiKey)
    );

    this.scrubDefaults();
  }

  public async complete(
    messages: Array<AzInf.ChatRequestMessage>,
    options: CompletionOptions = {},
    user: StatsigUser | {} = {}
  ): Promise<AzInf.ChatCompletionsOutput> {
    const ic = this.logInvoke(user, "complete");
    const response = await this.completeInternal(messages, options, false);

    this.handleError(response);
    const body = (response as AzInf.GetChatCompletions200Response).body;
    this.logUsage(
      user,
      "complete",
      {
        model: body.model,
        completion_tokens: body.usage.completion_tokens,
        prompt_tokens: body.usage.prompt_tokens,
        total_tokens: body.usage.total_tokens,
        created: body.created,
      },
      ic
    );
    return body;
  }

  public async streamComplete(
    messages: Array<AzInf.ChatRequestMessage>,
    options: CompletionOptions = {},
    user: StatsigUser | {} = {}
  ): Promise<AsyncIterable<EventMessage>> {
    const ic = this.logInvoke(user, "stream");
    const response = await this.completeInternal(messages, options, true);

    this.handleError(response);
    const stream = (response as HttpBrowserStreamResponse).body;

    const streamStart = Date.now();
    let model = null as string | null;
    this.logUsage(user, "stream_begin", {}, ic);
    const iterable = new ObservableEventStream(
      createSseStream(stream),
      (message) => {
        if (!model) {
          try {
            const obj = JSON.parse(message.data);
            model = obj.model;
          } catch (e) {}
        }
        if (message.data === "[DONE]") {
          this.logUsage(
            user,
            "stream_end",
            {
              stream_time_ms: Date.now() - streamStart,
              model: model || "unknown",
            },
            ic
          );
        }
      }
    );
    return iterable;
  }

  public async getInfo(
    user: StatsigUser | {} = {}
  ): Promise<AzInf.ModelInfoOutput> {
    const ic = this.logInvoke(user, "getInfo");
    const response = await this.azureClient.path("/info").get();

    this.handleError(response);
    const body = (response as AzInf.GetModelInfo200Response).body;
    this.logUsage(
      user,
      "getInfo",
      {
        model_name: body.model_name,
        model_provider_name: body.model_provider_name,
        model_type: body.model_type,
      },
      ic
    );
    return body;
  }

  public async getEmbeddings(
    input: string[],
    options: EmbeddingsOptions = {},
    user: StatsigUser | {} = {}
  ): Promise<AzInf.EmbeddingsResultOutput> {
    const ic = this.logInvoke(user, "getEmbeddings");
    const response = await this.azureClient.path("/embeddings").post({
      body: {
        input,
        ...options,
      },
      headers: this.getHeaders(),
    });

    this.handleError(response);
    const body = (response as AzInf.GetEmbeddings200Response).body;
    this.logUsage(
      user,
      "getEmbeddings",
      {
        model: body.model,
        prompt_tokens: body.usage.prompt_tokens,
        total_tokens: body.usage.total_tokens,
        embedding_length: body.data.length,
      },
      ic
    );
    return body;
  }

  private async completeInternal(
    messages: Array<AzInf.ChatRequestMessage>,
    options: CompletionOptions,
    stream: boolean
  ): Promise<
    | AzInf.GetChatCompletions200Response
    | AzInf.GetChatCompletionsDefaultResponse
    | HttpBrowserStreamResponse
  > {
    const postResponse = this.azureClient.path("/chat/completions").post({
      body: {
        messages,
        stream,
        ...this.completionDefaults,
        ...options,
      },
      headers: this.getHeaders(),
    });

    if (stream) {
      return postResponse.asBrowserStream();
    } else {
      return postResponse;
    }
  }

  private getHeaders() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "extra-parameters": "pass-through",
    };
  }

  private handleError(response: PathUncheckedResponse) {
    if (AzInf.isUnexpected(response)) {
      const error = response.body?.error;
      if (error) {
        const details = error.details
          ? `\n${JSON.stringify(error.details)}`
          : "";
        throw new Error(`${error.code}: ${error.message}${details}`);
      }
      throw new Error(JSON.stringify(response.body));
    }
    if (response.status !== "200") {
      throw new Error(`Unexpected status code: ${response}`);
    }
  }

  private scrubDefaults() {
    if (this.completionDefaults.max_tokens === 0) {
      delete this.completionDefaults.max_tokens;
    }
    if (!this.completionDefaults.stop) {
      delete this.completionDefaults.stop;
    }
  }

  private logInvoke(user: StatsigUser | {}, method: string): InvokeContext {
    const su = getStatsigUser(user);
    Statsig.logEvent(su, "invoke", method, {
      sdk_type: "azureai-nodejs",
    });
    return {
      invokeTime: Date.now(),
    };
  }

  private logUsage(
    user: StatsigUser | {},
    method: string,
    usage: Record<string, string | number>,
    context: InvokeContext | null = null
  ) {
    const su = getStatsigUser(user);
    let contextData = {};
    if (context) {
      contextData = {
        latency_ms: Date.now() - context.invokeTime,
      };
    }
    Statsig.logEvent(su, "usage", method, {
      sdk_type: "azureai-nodejs",
      ...contextData,
      ...usage,
    });
  }
}
