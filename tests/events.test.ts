// tests/events.test.ts — AC-C3 (closes the missing kernel/events coverage gap
// the reviewer found). Tests src/kernel/events.ts DIRECTLY:
//   - captureMountError(page, err) records a {kind:"mount", ...} entry that
//     pendingEvents() returns                                          (AC-C3)
//   - the 10s dedup window collapses duplicates: the SAME kind|message within
//     the window yields exactly ONE buffered entry                     (AC-C3)
//   - the buffer caps at 100 (CAP) — flooding never exceeds it         (AC-C3)
// Source ported from: redpash-rust-pwa/frontend/framework/boot/events.js
//
// NOTE: events.ts keeps a MODULE-LEVEL buffer + dedup map with no reset export,
// so the buffer accumulates across tests in this run. Each test therefore uses
// UNIQUE page/message tokens and asserts on presence/deltas (never absolute
// buffer length), so it is order-independent and robust to prior entries.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDomShim } from "./_dom-shim.ts";

// events.ts touches `window`/`console` only inside installErrorCapture/capture;
// the shim provides addEventListener-bearing globals for completeness.
installDomShim();

// RED-or-GREEN: these pass immediately since events.ts already exists — this is
// the coverage the reviewer flagged as missing, not the fix-locking test.
import { captureMountError, pendingEvents } from "../src/kernel/events.ts";

test("AC-C3: captureMountError(page, err) records a {kind:'mount'} entry pendingEvents() returns", () => {
  // Unique page token so this entry is unambiguous regardless of prior buffer.
  const page = "events-ac-c3-record-" + Math.random().toString(36).slice(2);
  captureMountError(page, new Error("boom-detail"));

  const events = pendingEvents();
  const entry = events.find((e) => e.kind === "mount" && e.message === `page ${page} failed`);
  assert.ok(entry, `pendingEvents() must contain a mount entry for ${page}`);
  assert.equal(entry!.kind, "mount", "captured kind is 'mount'");
  assert.equal(entry!.message, `page ${page} failed`, "message is `page <id> failed`");
  assert.equal(entry!.detail, "boom-detail", "detail carries the Error.message");
  assert.equal(typeof entry!.at, "string", "entry carries an ISO timestamp");

  // pendingEvents() returns a COPY (mutating it must not corrupt the buffer).
  events.length = 0;
  assert.ok(
    pendingEvents().some((e) => e.message === `page ${page} failed`),
    "pendingEvents() returns a defensive copy (slice), not the live buffer",
  );
});

test("AC-C3: the 10s dedup window collapses duplicate kind|message into ONE entry", () => {
  const page = "events-ac-c3-dedup-" + Math.random().toString(36).slice(2);
  const expectedMessage = `page ${page} failed`;

  // Three captures with the SAME page (=> same kind|message key) within the
  // 10s window. Differing detail must NOT defeat dedup (the key is kind|message).
  captureMountError(page, new Error("first"));
  captureMountError(page, new Error("second"));
  captureMountError(page, new Error("third"));

  const matches = pendingEvents().filter((e) => e.kind === "mount" && e.message === expectedMessage);
  assert.equal(
    matches.length,
    1,
    `dedup window must collapse same kind|message to one entry, got ${matches.length}`,
  );
  // The FIRST capture wins (later ones are dropped inside the window).
  assert.equal(matches[0]!.detail, "first", "the first capture's detail is the one retained");
});

test("AC-C3: the buffer caps at 100 (CAP) — flooding distinct events never exceeds it", () => {
  // Flood with 200 DISTINCT kind|message keys (unique per push so dedup never
  // applies). The CAP=100 guard must keep pendingEvents().length <= 100 no
  // matter how much prior content the shared buffer already held.
  for (let i = 0; i < 200; i++) {
    captureMountError(`events-ac-c3-cap-${i}-${Math.random().toString(36).slice(2)}`, new Error(`e${i}`));
  }
  assert.ok(
    pendingEvents().length <= 100,
    `buffer must cap at 100, got ${pendingEvents().length}`,
  );
});
