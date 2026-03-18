import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { SCHEMA_SQL } from "../../../src/state/migrations.js";
import { SQLiteStore } from "../../../src/state/sqlite-store.js";
import { SQLiteProjectStore } from "../../../src/state/project-store.js";
import type { StateStore } from "../../../src/state/types.js";

describe("SQLiteStore – Messages", () => {
  let store: StateStore;
  let db: Database.Database;
  let projectId: string;

  beforeEach(() => {
    db = new Database(":memory:");
    db.exec(SCHEMA_SQL);
    const projectStore = new SQLiteProjectStore(db);
    const project = projectStore.createProject("test-project", "/tmp/test");
    projectId = project.id;
    store = new SQLiteStore(db, projectId);
  });

  afterEach(() => {
    store.close();
  });

  it("addMessage creates a user message", () => {
    const msg = store.addMessage("user", "Hello from user");

    expect(msg.id).toBeGreaterThan(0);
    expect(msg.projectId).toBe(projectId);
    expect(msg.role).toBe("user");
    expect(msg.content).toBe("Hello from user");
    expect(msg.read).toBe(false);
    expect(msg.createdAt).toBeTruthy();
  });

  it("addMessage creates an agent message", () => {
    const msg = store.addMessage("agent", "Hello from agent");

    expect(msg.id).toBeGreaterThan(0);
    expect(msg.projectId).toBe(projectId);
    expect(msg.role).toBe("agent");
    expect(msg.content).toBe("Hello from agent");
    expect(msg.read).toBe(false);
    expect(msg.createdAt).toBeTruthy();
  });

  it("getMessages returns messages in order", () => {
    store.addMessage("user", "First");
    store.addMessage("agent", "Second");
    store.addMessage("user", "Third");

    const messages = store.getMessages();
    expect(messages).toHaveLength(3);
    expect(messages[0].content).toBe("First");
    expect(messages[1].content).toBe("Second");
    expect(messages[2].content).toBe("Third");
  });

  it("getMessages respects limit", () => {
    store.addMessage("user", "One");
    store.addMessage("agent", "Two");
    store.addMessage("user", "Three");

    const messages = store.getMessages(2);
    expect(messages).toHaveLength(2);
    expect(messages[0].content).toBe("One");
    expect(messages[1].content).toBe("Two");
  });

  it("getUnreadMessages returns only unread", () => {
    store.addMessage("user", "Unread 1");
    store.addMessage("agent", "Unread 2");
    store.markMessagesRead();
    store.addMessage("user", "Unread 3");

    const unread = store.getUnreadMessages();
    expect(unread).toHaveLength(1);
    expect(unread[0].content).toBe("Unread 3");
  });

  it("markMessagesRead marks all as read", () => {
    store.addMessage("user", "Msg 1");
    store.addMessage("agent", "Msg 2");

    expect(store.getUnreadMessages()).toHaveLength(2);

    store.markMessagesRead();

    expect(store.getUnreadMessages()).toHaveLength(0);

    const allMessages = store.getMessages();
    expect(allMessages).toHaveLength(2);
    expect(allMessages[0].read).toBe(true);
    expect(allMessages[1].read).toBe(true);
  });

  it("messages are scoped by project_id", () => {
    const projectStore = new SQLiteProjectStore(db);
    const project2 = projectStore.createProject("other", "/tmp/other");
    const store2 = new SQLiteStore(db, project2.id);

    store.addMessage("user", "Project 1 message");
    store2.addMessage("agent", "Project 2 message");

    const msgs1 = store.getMessages();
    const msgs2 = store2.getMessages();

    expect(msgs1).toHaveLength(1);
    expect(msgs1[0].content).toBe("Project 1 message");
    expect(msgs1[0].projectId).toBe(projectId);

    expect(msgs2).toHaveLength(1);
    expect(msgs2[0].content).toBe("Project 2 message");
    expect(msgs2[0].projectId).toBe(project2.id);
  });
});
