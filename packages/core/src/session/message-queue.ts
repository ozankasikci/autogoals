interface SDKUserMessage {
  type: "user";
  message: { role: "user"; content: string };
}

const CLOSED_SENTINEL = Symbol("closed");

export class MessageQueue {
  private messages: SDKUserMessage[] = [];
  private waiting:
    | { resolve: (msg: SDKUserMessage | typeof CLOSED_SENTINEL) => void }
    | null = null;
  private closed = false;

  push(content: string): void {
    const msg: SDKUserMessage = {
      type: "user",
      message: { role: "user", content },
    };
    if (this.waiting) {
      const { resolve } = this.waiting;
      this.waiting = null;
      resolve(msg);
    } else {
      this.messages.push(msg);
    }
  }

  async *[Symbol.asyncIterator](): AsyncIterator<SDKUserMessage> {
    while (true) {
      if (this.messages.length > 0) {
        yield this.messages.shift()!;
      } else if (this.closed) {
        break;
      } else {
        const result = await new Promise<SDKUserMessage | typeof CLOSED_SENTINEL>(
          (resolve) => {
            this.waiting = { resolve };
          },
        );
        if (result === CLOSED_SENTINEL) {
          break;
        }
        yield result;
      }
    }
  }

  close(): void {
    this.closed = true;
    if (this.waiting) {
      const { resolve } = this.waiting;
      this.waiting = null;
      resolve(CLOSED_SENTINEL);
    }
  }

  get isClosed(): boolean {
    return this.closed;
  }
}
