import { EventMessage } from "@azure/core-sse";

export default class ObservableEventStream 
  implements AsyncIterable<EventMessage> {
  private baseStream: AsyncIterable<EventMessage>;
  private iterator: AsyncIterator<EventMessage>;
  private onMessage?: (message: EventMessage) => void;

  constructor(
    baseStream: AsyncIterable<EventMessage>,
    onMessage?: (message: EventMessage) => void
  ) {
    this.baseStream = baseStream;
    this.iterator = baseStream[Symbol.asyncIterator]();
    this.onMessage = onMessage;
  }

  public getBaseStream() {
    return this.baseStream;
  }

  [Symbol.asyncIterator](): AsyncIterator<EventMessage> {
    return {
      next: async () => {
        const { done, value } = await this.iterator.next();
        if (this.onMessage) {
          this.onMessage(value);
        }
        return { done, value };
      }
    }
  }
}