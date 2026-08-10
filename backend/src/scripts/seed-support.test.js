import assert from "node:assert/strict";
import test from "node:test";
import { supportSeed } from "./seed-support.js";

test("support seed contains seven realistic customer conversations", () => {
  const statusCounts = {
    waiting: supportSeed.filter((item) => item.status === "waiting").length,
    active: supportSeed.filter((item) => item.status === "active").length,
    resolved: supportSeed.filter((item) => item.status === "resolved").length,
  };

  assert.equal(supportSeed.length, 7);
  assert.equal(new Set(supportSeed.map((item) => item.seedKey)).size, 7);
  assert.equal(new Set(supportSeed.map((item) => item.customerEmail)).size, 7);
  assert.deepEqual(statusCounts, { waiting: 0, active: 0, resolved: 7 });
  assert.equal(supportSeed.filter((item) => item.priority === "urgent").length, 2);
  assert.equal(supportSeed.filter((item) => item.bookingSeedKey).length, 6);
  assert.equal(supportSeed.reduce((total, item) => total + item.messages.length, 0), 23);
});

test("support messages are chronological and match the conversation state", () => {
  for (const conversation of supportSeed) {
    assert.ok(conversation.messages.length > 0);
    const openedAt = new Date(conversation.openedAt);
    let previousMessageAt = openedAt;

    for (const message of conversation.messages) {
      const sentAt = new Date(message.sentAt);
      assert.equal(Number.isNaN(sentAt.getTime()), false);
      assert.ok(sentAt >= previousMessageAt, `Out-of-order message in ${conversation.seedKey}`);
      previousMessageAt = sentAt;
    }

    assert.equal(conversation.status, "resolved");
    assert.equal(conversation.messages.at(-1).sender, "admin");
    assert.equal(
      conversation.messages
        .filter((message) => message.sender === "customer")
        .every((message) => message.isRead),
      true,
    );
  }
});
