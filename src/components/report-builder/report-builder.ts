/* report-builder — the "show me [measure] for each [breakdown]" form. A product-
   agnostic shell: it knows nothing about files or endpoints — it takes the
   available columns + the aggregation vocabulary, and emits the builder STATE
   ({groupBy, measures}) on Run. The consumer turns that into a server report spec
   and renders the result wherever it likes (a bare grid-view). Group-by columns
   are removable chips; measures are fn × column rows. Pivot / windows / top-N /
   sort are the Advanced surface for a later pass.

   mountReportBuilder(host, {
     columns: [{key, label}],
     aggFns:  [{value, label}],            // the aggregation vocabulary
     onRun({ groupBy: [key], measures: [{col, fn}] }),
     onClear?(),
   }) -> { el, update({columns}), destroy }

   Composes atoms.button + mountSelect; sole owner of every .amu-rb* class
   (ui-fork-audit R4). */

import { el } from "../../kernel/dom.ts";
import { button } from "../atoms/atoms.ts";
import { mountSelect } from "../select/select.ts";
import type { SelectOption } from "../select/select.ts";
import type { MountHandle } from "../../contract/index.ts";

export interface ReportColumn {
  key: string;
  label?: string;
}

export interface ReportMeasure {
  col: string;
  fn: string;
}

export interface ReportState {
  groupBy: string[];
  measures: ReportMeasure[];
}

export interface ReportBuilderCfg {
  columns?: ReportColumn[];
  /** The aggregation vocabulary ({value, label}); first is the default fn. */
  aggFns?: SelectOption[];
  onRun?: (state: ReportState) => void;
  onClear?: () => void;
}

export interface ReportBuilderUpdate {
  columns?: ReportColumn[];
}

export function mountReportBuilder(
  host: Element,
  cfg: ReportBuilderCfg,
): MountHandle<ReportBuilderUpdate> {
  let columns = cfg.columns ?? [];
  const aggFns = cfg.aggFns ?? [];
  const defaultFn = (): string => aggFns[0]?.value ?? "count";
  let groupBy: string[] = []; // [colKey]
  let measures: ReportMeasure[] = [{ col: "", fn: defaultFn() }];

  const root = el("div", { class: "amu-rb" });
  const gbWrap = el("div", { class: "amu-rb-section" });
  const mWrap = el("div", { class: "amu-rb-section" });
  const foot = el(
    "div",
    { class: "amu-rb-foot" },
    button({ label: "Clear", variant: "ghost", onClick: clearAll }),
    button({ label: "Run", variant: "accent", onClick: run }),
  );
  root.append(gbWrap, mWrap, foot);

  const colOpts = (): SelectOption[] =>
    columns.map((c) => ({ value: c.key, label: c.label ?? c.key }));
  const colLabel = (k: string): string => columns.find((c) => c.key === k)?.label ?? k;

  function renderGroupBy(): void {
    gbWrap.replaceChildren(el("h3", { class: "amu-rb-heading" }, "Group by"));
    const chips = el("div", { class: "amu-rb-chips" });
    if (!groupBy.length) chips.append(el("span", { class: "amu-rb-empty" }, "the whole file"));
    for (const k of groupBy) {
      chips.append(
        el(
          "button",
          {
            class: "amu-rb-chip",
            type: "button",
            title: "Remove",
            onclick: () => {
              groupBy = groupBy.filter((x) => x !== k);
              render();
            },
          },
          el("span", {}, colLabel(k)),
          el("i", { class: "bi bi-x" }),
        ),
      );
    }
    gbWrap.append(chips);
    const unused = columns.filter((c) => !groupBy.includes(c.key));
    if (unused.length) {
      const addHost = el("span", { class: "amu-rb-add" });
      mountSelect(addHost, {
        options: [
          { value: "", label: "+ add column…" },
          ...unused.map((c) => ({ value: c.key, label: c.label ?? c.key })),
        ],
        value: "",
        onChange: (v) => {
          if (v) {
            groupBy.push(v);
            render();
          }
        },
      });
      gbWrap.append(addHost);
    }
  }

  function renderMeasures(): void {
    mWrap.replaceChildren(el("h3", { class: "amu-rb-heading" }, "Measures"));
    const list = el("div", { class: "amu-rb-measures" });
    measures.forEach((m, i) => {
      const fnHost = el("span", { class: "amu-rb-mfn" });
      mountSelect(fnHost, {
        options: aggFns,
        value: m.fn,
        onChange: (v) => {
          m.fn = v;
        },
      });
      const colHost = el("span", { class: "amu-rb-mcol" });
      mountSelect(colHost, {
        options: [{ value: "", label: "column…" }, ...colOpts()],
        value: m.col,
        onChange: (v) => {
          m.col = v;
        },
      });
      const rm = button({
        label: "✕",
        variant: "ghost",
        size: "sm",
        onClick: () => {
          measures.splice(i, 1);
          if (!measures.length) measures.push({ col: "", fn: defaultFn() });
          render();
        },
      });
      rm.classList.add("amu-rb-mremove");
      list.append(el("div", { class: "amu-rb-measure" }, fnHost, colHost, rm));
    });
    mWrap.append(list);
    const add = button({
      label: "+ Add measure",
      variant: "ghost",
      size: "sm",
      onClick: () => {
        measures.push({ col: "", fn: defaultFn() });
        render();
      },
    });
    add.classList.add("amu-rb-add-measure");
    mWrap.append(add);
  }

  function render(): void {
    renderGroupBy();
    renderMeasures();
  }

  function clearAll(): void {
    groupBy = [];
    measures = [{ col: "", fn: defaultFn() }];
    render();
    cfg.onClear?.();
  }
  function run(): void {
    cfg.onRun?.({
      groupBy: [...groupBy],
      measures: measures.filter((m) => m.col).map((m) => ({ col: m.col, fn: m.fn })),
    });
  }

  render();
  host.append(root);
  return {
    el: root,
    update: (p: ReportBuilderUpdate = {}) => {
      if (p.columns) columns = p.columns;
      render();
    },
    destroy: () => root.remove(),
  };
}
