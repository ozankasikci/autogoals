import { describe, it, expect } from "vitest";
import { MessageQueue } from "../../../src/session/message-queue.js";

describe("MessageQueue", () => {
  it("yields pushed messages in order", async () => {
    const queue = new MessageQueue();
    queue.push("first");
    queue.push("second");
    queue.close();

    const messages: string[] = [];
    for await (const msg of queue) {
      messages.push(msg.message.content);
    }
    expect(messages).toEqual(["first", "second"]);
  });

  it("waits for messages when empty", async () => {
    const queue = new MessageQueue();

    // Push after a delay
    setTimeout(() => {
      queue.push("delayed");
      queue.close();
    }, 50);

    const messages: string[] = [];
    for await (const msg of queue) {
      messages.push(msg.message.content);
    }
    expect(messages).toEqual(["delayed"]);
  });

  it("reports closed state", () => {
    const queue = new MessageQueue();
    expect(queue.isClosed).toBe(false);
    queue.close();
    expect(queue.isClosed).toBe(true);
  });
});
