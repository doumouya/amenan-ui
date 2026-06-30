/* termbar — the Console top strip (AC-17), ported from web-kit's `termbar` to
   amenan conventions: class `.amu-termbar` (+ `.amu-termbar-*` children), a
   co-located CSS sheet `@import`ed by styles.css (NOT web-kit's injected
   `ensureStyles`), and a `mountTermbar(host, cfg) → MountHandle` factory built on
   the kernel `el`.

   Renders: three traffic-light dots + the "doumouya" wordmark + the per-app cwd +
   a status pill + a light/dark toggle. The toggle is WIRED TO theme.ts — it calls
   `toggleMode()` (NOT a raw mode attribute write or web-kit's own localStorage
   key), reads `getMode()` to label `☀ light` / `☾ dark`, and subscribes via
   `onThemeChange` so the label stays in sync when the mode flips elsewhere.

   Scrub-clean: no web-kit class prefixes, no legacy storage key — the two-axis
   theme.ts owns persistence under `amu-theme`/`amu-mode`. */

import { el } from "../../kernel/dom.ts";
import type { MountHandle } from "../../contract/index.ts";
import { getMode, toggleMode, onThemeChange } from "../../theme/theme.ts";

export interface TermbarCfg {
  /** The per-app path shown after the wordmark (e.g. "~/rbac-explorer"). */
  cwd: string;
  /** The status pill text; defaults to the privacy pill. */
  status?: string;
}

/** The narrow update — change the cwd / status pill text in place. */
export interface TermbarUpdate {
  cwd?: string;
  status?: string;
}

/** Build the Console top strip into `host`. The toggle drives theme.ts mode. */
export function mountTermbar(host: Element, cfg: TermbarCfg): MountHandle<TermbarUpdate> {
  const cwd = el("span", { class: "amu-termbar-cwd" }, cfg.cwd);
  const status = el("span", { class: "amu-termbar-status" }, cfg.status ?? "● client-side");

  const toggle = el("button", {
    class: "amu-termbar-toggle",
    type: "button",
    "aria-label": "Toggle light or dark theme",
  });
  const syncToggle = (): void => {
    toggle.textContent = getMode() === "dark" ? "☀ light" : "☾ dark";
  };
  toggle.addEventListener("click", () => toggleMode());
  // Stay in sync when the mode flips from anywhere (the toggle, another termbar,
  // the prefs surface). onThemeChange returns an unsubscribe used in destroy().
  const unsub = onThemeChange(() => syncToggle());
  syncToggle();

  // Build the root then appendChild each child (not el-varargs): the kernel `el`'s
  // node duck-test keys on `nodeType`, so already-built element children are
  // appended directly rather than re-coerced — the structure the strip relies on.
  const root = el("div", { class: "amu-termbar" });
  root.appendChild(el("span", { class: "amu-termbar-dot" }));
  root.appendChild(el("span", { class: "amu-termbar-dot" }));
  root.appendChild(el("span", { class: "amu-termbar-dot" }));
  root.appendChild(el("span", { class: "amu-termbar-name" }, "doumouya"));
  root.appendChild(cwd);
  root.appendChild(toggle);
  root.appendChild(status);

  host.appendChild(root);
  return {
    el: root,
    update(p: TermbarUpdate) {
      if (p.cwd != null) cwd.textContent = p.cwd;
      if (p.status != null) status.textContent = p.status;
    },
    destroy() {
      unsub();
      root.remove();
    },
  };
}
