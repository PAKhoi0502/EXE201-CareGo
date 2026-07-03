import assert from "node:assert/strict";
import test from "node:test";
import { getLegalRequirements } from "../legal/legal-documents.js";
import { validateLegalAcceptances } from "./legal-consent.js";

const request = {
  ip: "127.0.0.1",
  get: (name) => name === "user-agent" ? "CareGo legal consent test" : "",
};

const buildAcceptances = (flow) => getLegalRequirements(flow).map((document) => ({
  documentType: document.type,
  documentVersion: document.version,
  accepted: true,
}));

for (const flow of ["CUSTOMER_SIGNUP", "COMPANION_APPLICATION", "ELDER_PROFILE_CREATE"]) {
  test(`${flow} accepts the active legal document versions`, () => {
    const result = validateLegalAcceptances({
      acceptances: buildAcceptances(flow),
      flow,
      req: request,
    });

    assert.equal(result.error, undefined);
    assert.equal(result.acceptances.length, getLegalRequirements(flow).length);
    assert.ok(result.acceptances.every((item) => item.documentHash.length === 64));
    assert.ok(result.acceptances.every((item) => item.acceptedAt instanceof Date));
  });
}

test("missing acceptance is rejected", () => {
  const acceptances = buildAcceptances("CUSTOMER_SIGNUP");
  acceptances[0].accepted = false;
  const result = validateLegalAcceptances({
    acceptances,
    flow: "CUSTOMER_SIGNUP",
    req: request,
  });

  assert.match(result.error, /cần đồng ý/i);
});

test("outdated document version is rejected", () => {
  const acceptances = buildAcceptances("COMPANION_APPLICATION");
  acceptances[0].documentVersion = "outdated";
  const result = validateLegalAcceptances({
    acceptances,
    flow: "COMPANION_APPLICATION",
    req: request,
  });

  assert.match(result.error, /phiên bản mới/i);
});
