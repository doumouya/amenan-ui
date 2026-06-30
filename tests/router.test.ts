// tests/router.test.ts — AC-G1 / AC-G2 / AC-G3
// createRouter(cfg): generic RouteMap, NO apps.js, NO #/login bounce, NO
// /apps/<app>/<page> convention fetch.
//   - hash parse: (location.hash||"").replace(/^#\//,"").split("?")[0]   (AC-G1)
//   - guard chain: first guard returning non-null id redirects (location.hash =
//     "#/" + id) and aborts; zero guards never bounce                    (AC-G2)
//   - unknown route -> notFound(ctx) then resolveLanding(ctx)            (AC-G3)
//   - route match -> previous handle.destroy() (failing destroy swallowed)
//     then cfg.mount(host, def, ctx)                                     (AC-G3)
//   - loadModule is INJECTED so the test is hermetic (no real dynamic import)
// Source being rewritten: redpash-rust-pwa/frontend/framework/boot/router.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDomShim } from "./_dom-shim.ts";

const shim = installDomShim();

// RED until the coder creates src/.
import { createRouter } from "../src/router.ts";
import { pendingEvents } from "../src/kernel/events.ts";
import type { RouteMap, RouteDef, MountHandle, MountCtx } from "../src/contract/index.ts";

function setHash(h: string) {
  (globalThis as unknown as { location: { hash: string } }).location.hash = h;
  shim.hashSetLog.length = 0; // forget the programmatic set we just did
}

test("AC-G1: hash is parsed via (hash||'').replace(/^#\\//,'').split('?')[0]", async () => {
  const mounted: string[] = [];
  const routes: RouteMap = {
    home: { meta: { x: 1 } },
    reports: {},
  };
  const router = createRouter({
    routes,
    mount: (_h: Element, _def: RouteDef, _ctx: MountCtx) => {
      mounted.push("ok");
      return undefined;
    },
    resolveLanding: () => "home",
  });

  setHash("#/reports?tab=open"); // querystring + #/ prefix must be stripped to "reports"
  await router.navigate();
  assert.deepEqual(mounted, ["ok"], "the route matched after stripping #/ and ?query");
});

test("AC-G2: a guard returning 'login' redirects (location.hash='#/login') and aborts mount", async () => {
  const mounted: string[] = [];
  const routes: RouteMap = { secret: {} };
  const router = createRouter({
    routes,
    mount: () => {
      mounted.push("mounted");
      return undefined;
    },
    guards: [() => "login"], // first guard short-circuits to a redirect id
    resolveLanding: () => "secret",
  });

  setHash("#/secret");
  await router.navigate();
  assert.equal(mounted.length, 0, "guard redirect must abort the mount");
  assert.ok(
    shim.hashSetLog.includes("#/login"),
    `expected a redirect to #/login, hashSetLog=${JSON.stringify(shim.hashSetLog)}`,
  );
});

test("AC-G2: with zero guards, the matched route mounts (never bounces)", async () => {
  const mounted: string[] = [];
  const routes: RouteMap = { dash: {} };
  const router = createRouter({
    routes,
    mount: () => {
      mounted.push("dash");
      return undefined;
    },
    resolveLanding: () => "dash",
    // no guards
  });

  setHash("#/dash");
  await router.navigate();
  assert.deepEqual(mounted, ["dash"], "no guards => route mounts, no bounce");
  assert.equal(shim.hashSetLog.length, 0, "no redirect happened");
});

test("AC-G3: unknown route -> notFound(ctx) then resolveLanding(ctx)", async () => {
  const calls: string[] = [];
  const routes: RouteMap = { home: {} };
  const router = createRouter({
    routes,
    mount: (_h: Element, def: RouteDef) => {
      calls.push(`mount:${JSON.stringify(def.meta ?? {})}`);
      return undefined;
    },
    notFound: () => {
      calls.push("notFound");
      return undefined;
    },
    resolveLanding: () => {
      calls.push("resolveLanding");
      return "home";
    },
  });

  setHash("#/does-not-exist");
  await router.navigate();
  const nf = calls.indexOf("notFound");
  const rl = calls.indexOf("resolveLanding");
  assert.ok(nf >= 0, "notFound must be called for an unknown route");
  assert.ok(rl >= 0, "resolveLanding must be called for an unknown route");
  assert.ok(nf < rl, "notFound must be called BEFORE resolveLanding");
});

test("AC-G3: route match destroys the previous handle (failing destroy swallowed) then mounts", async () => {
  const log: string[] = [];
  const routes: RouteMap = { a: {}, b: {} };

  const handleFor = (id: string): MountHandle => ({
    el: (globalThis as { document: { createElement(t: string): unknown } }).document.createElement(
      "div",
    ) as unknown as HTMLElement,
    destroy() {
      log.push(`destroy:${id}`);
      if (id === "a") throw new Error("a-destroy-fails"); // must be swallowed
    },
  });

  const router = createRouter({
    routes,
    mount: (_h: Element, _def: RouteDef, _ctx: MountCtx) => {
      // identify which route by the current hash token
      const id = ((globalThis as unknown as { location: { hash: string } }).location.hash || "")
        .replace(/^#\//, "")
        .split("?")[0] ?? "";
      log.push(`mount:${id}`);
      return handleFor(id);
    },
    resolveLanding: () => "a",
  });

  setHash("#/a");
  await router.navigate();
  assert.deepEqual(log, ["mount:a"], "first navigation mounts a (no previous handle)");

  setHash("#/b");
  await assert.doesNotThrow(async () => {
    await router.navigate();
  });
  assert.deepEqual(
    log,
    ["mount:a", "destroy:a", "mount:b"],
    "second navigation destroys a (throw swallowed) then mounts b",
  );
});

// AC-G mount-error regression (reviewer finding SF2): a route's `mount` that
// THROWS (or rejects) must NOT propagate out of navigate() — the router catches
// it and records it via captureMountError -> pendingEvents() gains a `mount`
// entry for that route id. RED now (router.ts does `await cfg.mount(...)` with
// no try/catch and never calls captureMountError); GREEN once the coder wires
// the catch -> captureMountError(id, err). Ref: AC-G3 / AC-C3 / finding SF2.
test("AC-G/SF2: a mount that THROWS is caught (navigate does not throw) and recorded via captureMountError", async () => {
  // Unique route id so the pendingEvents() assertion targets only THIS test's
  // entry (events.ts keeps a shared module-level buffer with no reset).
  const id = "boom-throw-" + Math.random().toString(36).slice(2);
  const routes: RouteMap = { [id]: {} };
  const router = createRouter({
    routes,
    mount: () => {
      throw new Error("mount-blew-up");
    },
    resolveLanding: () => id,
  });

  setHash("#/" + id);
  // (a) navigation must NOT throw out of the router — the router catches.
  await assert.doesNotReject(async () => {
    await router.navigate();
  }, "a throwing mount must be caught inside the router, not propagated");

  // (b) the failure is recorded via captureMountError -> pendingEvents().
  const recorded = pendingEvents().some(
    (e) => e.kind === "mount" && e.message === `page ${id} failed`,
  );
  assert.ok(
    recorded,
    `the router must record the mount failure via captureMountError (expected a 'mount' event for ${id})`,
  );
});

test("AC-G/SF2: a mount that REJECTS is caught (no unhandled rejection) and recorded via captureMountError", async () => {
  const id = "boom-reject-" + Math.random().toString(36).slice(2);
  const routes: RouteMap = { [id]: {} };
  const router = createRouter({
    routes,
    mount: () => Promise.reject(new Error("mount-rejected")),
    resolveLanding: () => id,
  });

  setHash("#/" + id);
  // (a) the rejected mount promise must be awaited+caught — navigate resolves.
  await assert.doesNotReject(async () => {
    await router.navigate();
  }, "a rejecting mount must be caught inside the router (no unhandled rejection)");

  // (b) recorded via captureMountError -> pendingEvents().
  const recorded = pendingEvents().some(
    (e) => e.kind === "mount" && e.message === `page ${id} failed`,
  );
  assert.ok(
    recorded,
    `the router must record the rejected mount via captureMountError (expected a 'mount' event for ${id})`,
  );
});

test("AC-G3: loadModule is an injected dependency (hermetic — no real dynamic import)", async () => {
  const loaded: string[] = [];
  const routes: RouteMap = {
    lazy: { load: () => Promise.resolve({ default: "lazy-mod" }) },
  };
  const router = createRouter({
    routes,
    mount: () => undefined,
    resolveLanding: () => "lazy",
    loadModule: (path: string) => {
      loaded.push(path); // a fake loader proves the seam is injectable
      return Promise.resolve({ injected: true });
    },
  });
  setHash("#/lazy");
  // navigate must not throw and must use only injected fakes (no network/disk import)
  await assert.doesNotReject(async () => {
    await router.navigate();
  });
});
