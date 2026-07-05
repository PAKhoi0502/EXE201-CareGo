import assert from "node:assert/strict";
import test from "node:test";
import AuditLog from "../models/audit-log.models.js";
import {
  buildAuditLogEntry,
  getHttpAuditAction,
  hashAuditIp,
  resolveAuditResource,
} from "./audit-log.js";

test("audit log schema has a TTL index on expiresAt", () => {
  const ttlIndex = AuditLog.schema.indexes().find(([fields]) => fields.expiresAt === 1);
  assert.ok(ttlIndex);
  assert.equal(ttlIndex[1].expireAfterSeconds, 0);
});

test("audit log expires about seven days after creation", () => {
  const before = Date.now();
  const log = new AuditLog({
    actorId: "507f1f77bcf86cd799439011",
    actorRole: "admin",
    source: "http",
    action: "http.read",
    outcome: "success",
  });
  const retentionMs = log.expiresAt.getTime() - before;
  assert.ok(retentionMs >= 7 * 24 * 60 * 60 * 1000 - 1000);
  assert.ok(retentionMs <= 7 * 24 * 60 * 60 * 1000 + 1000);
});

test("builds an audit entry without request payload data", () => {
  const entry = buildAuditLogEntry({
    actor: {
      userId: "507f1f77bcf86cd799439011",
      name: "CareGo Admin",
      email: "ADMIN@CAREGO.CFD",
      role: "admin",
    },
    source: "http",
    action: getHttpAuditAction("PATCH"),
    method: "PATCH",
    route: "/api/admin/users/507f1f77bcf86cd799439012/status?token=secret",
    outcome: "success",
    statusCode: 200,
    durationMs: 12.7,
    ipAddress: "127.0.0.1",
    userAgent: "Test browser",
  });

  assert.equal(entry.action, "http.update");
  assert.equal(entry.route, "/api/admin/users/507f1f77bcf86cd799439012/status");
  assert.equal(entry.resourceType, "users");
  assert.equal(entry.resourceId, "507f1f77bcf86cd799439012");
  assert.equal(entry.actorEmail, "admin@carego.cfd");
  assert.equal(entry.durationMs, 13);
  assert.ok(entry.ipHash);
  assert.equal(Object.hasOwn(entry, "body"), false);
});

test("ignores roles outside admin and companion", () => {
  const entry = buildAuditLogEntry({
    actor: { userId: "507f1f77bcf86cd799439011", role: "customer" },
    source: "http",
    action: "http.read",
  });
  assert.equal(entry, null);
});

test("hashes the same IP consistently without returning the raw value", () => {
  const first = hashAuditIp("203.0.113.10");
  const second = hashAuditIp("203.0.113.10");
  assert.equal(first, second);
  assert.notEqual(first, "203.0.113.10");
});

test("resolves resources for admin and ordinary API routes", () => {
  assert.deepEqual(resolveAuditResource("/api/admin/bookings/507f1f77bcf86cd799439011"), {
    resourceType: "bookings",
    resourceId: "507f1f77bcf86cd799439011",
  });
  assert.deepEqual(resolveAuditResource("/api/companions/me"), {
    resourceType: "companions",
    resourceId: "",
  });
});
