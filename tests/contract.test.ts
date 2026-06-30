// tests/contract.test.ts — AC-J7 (tsc IS the assertion)
// Declares a FAKE leaf component (factory (cfg?) => Node, wrapped via toMount)
// and a FAKE service-coupled component + a FAKE Service that satisfy
// Mount / MountHandle / Service from ../src/contract/. This file passing
// `tsc --noEmit` proves the seams compose. (The node:test body is a trivial
// runtime smoke check; the load-bearing assertion is the type-check.)
//
// NOTE for the coder's scaffold (AC-A2): tsconfig must `include` tests/ (or add
// a tsconfig.test.json that extends it) so `tsc --noEmit` actually type-checks
// this file. Without that include, AC-J7's "tsc IS the assertion" never runs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDomShim, FakeElement } from "./_dom-shim.ts";

installDomShim();

import { toMount } from "../src/contract/mount.ts";
import type {
  Mount,
  MountCtx,
  MountHandle,
  Component,
  Service,
} from "../src/contract/index.ts";

// ── 1. A FAKE leaf component: a factory (config?) => Node, wrapped via toMount.
interface ButtonCfg {
  label: string;
}
const buttonFactory = (cfg?: ButtonCfg): Node => {
  const el = new FakeElement("button") as unknown as HTMLElement;
  el.textContent = cfg?.label ?? "";
  return el as unknown as Node;
};
// toMount must turn a leaf factory into a uniform Mount — tsc checks the shape.
const buttonMount: Mount<ButtonCfg> = toMount(buttonFactory);

const leafComponent: Component<ButtonCfg> = {
  name: "fake-button",
  mount: buttonMount,
  meta: { tier: "leaf" },
};

// ── 2. A FAKE Service that satisfies the Service interface verbatim.
const fakeService: Service = {
  get: <T>(_path: string, _opts?: RequestInit): Promise<T> => Promise.resolve({} as T),
  post: <T>(_path: string, _body?: unknown, _opts?: RequestInit): Promise<T> =>
    Promise.resolve({} as T),
  put: <T>(_path: string, _body?: unknown): Promise<T> => Promise.resolve({} as T),
  patch: <T>(_path: string, _body?: unknown): Promise<T> => Promise.resolve({} as T),
  del: <T>(_path: string): Promise<T> => Promise.resolve({} as T),
  upload: <T>(_path: string, _file: File | FormData): Promise<T> => Promise.resolve({} as T),
};

// ── 3. A FAKE service-coupled component: a full Mount that reads ctx.service.
const listMount: Mount<{ path: string }> = (
  host: Element,
  ctx: MountCtx,
  config?: { path: string },
): MountHandle => {
  const el = new FakeElement("ul") as unknown as HTMLElement;
  (host as unknown as FakeElement).appendChild(el as unknown as FakeElement);
  // ctx.service is the data seam — typed as Service | undefined.
  void ctx.service?.get<unknown[]>(config?.path ?? "/items");
  return {
    el,
    update: (_partial: { path: string }) => {},
    destroy: () => {},
  };
};

const serviceComponent: Component<{ path: string }> = {
  name: "fake-list",
  mount: listMount,
};

test("AC-J7: the leaf + service-coupled fakes satisfy the contract (tsc is the assertion)", () => {
  // Runtime smoke: the shapes are usable. The real guarantee is tsc --noEmit.
  assert.equal(leafComponent.name, "fake-button");
  assert.equal(serviceComponent.name, "fake-list");
  assert.equal(typeof leafComponent.mount, "function");
  assert.equal(typeof serviceComponent.mount, "function");
  assert.equal(typeof fakeService.get, "function");

  const host = new FakeElement("div") as unknown as Element;
  const ctx: MountCtx = { service: fakeService };
  const handle = serviceComponent.mount(host, ctx, { path: "/x" });
  assert.ok(handle.el, "mount returns a handle with an el");
});
