/* chart-editor — author a chart over a source file: pick a source file + a
   group-by column + a measure (agg fn/col) + a chart type + a theme, and see a
   LIVE preview that re-renders as you change anything. The editor holds the chart
   cfg; getPayload() returns the persistable recipe (the chart definition MINUS the
   baked option — the option carries the aggregated, customer-derived data and is
   re-derived on render, never persisted).

   DECOUPLING (AC-H3): NO data fetch literal — both data seams are INJECTED:
     • `config.columns({ fileId })` → the source file's column names (replaces the
       /files/<id>/page columns call),
     • `config.preview({ fileId, groupBy, aggCol, aggFn })` → the aggregated rows
       (replaces the /group/preview call). Each row is [groupKey, …, aggregate].
   Composes select + atoms (W3) + the chart build/render/theme helpers (W4a;
   ECharts via window.echarts, graceful no-op when absent). Sole owner of every
   .amu-ce* class (ui-fork-audit R4).

   mountChartEditor(host, { files, columns, preview, initial?, aggFns?, onChange? })
     → { el, getPayload(), getOption(), valid(), destroy() } */

import { el } from "../../kernel/dom.ts";
import { input } from "../atoms/atoms.ts";
import { mountSelect } from "../select/select.ts";
import { TYPE_LIST, TYPE_TO_KIND, THEMES } from "../chart/build.ts";
import type { ChartCfg, BakedOption } from "../chart/build.ts";
import { renderChart, synthesizeOption } from "../chart/render.ts";
import type { EChartsInstance } from "../chart/theme.ts";
import { chartTheme } from "../chart/theme.ts";
import type { MountHandle, Source } from "../../contract/index.ts";

/** A selectable source file. */
export interface ChartEditorFile {
  rid: string;
  filename: string;
}

/** The persistable chart spec (definition minus the baked option). Open-ended —
    it carries the chart vocabulary the consumer persists. */
export type ChartRecipe = Omit<ChartCfg, "option">;

/** The persistable payload the consumer POSTs to create/update a chart. */
export interface ChartPayload {
  source_file_id: string;
  title: string;
  spec: ChartRecipe;
}

/** An aggregation function: [value, label]. */
export type AggFn = [string, string];

export interface ChartEditorInitial {
  title?: string;
  source_file_id?: string;
  spec?: Partial<ChartCfg>;
}

export interface ChartEditorCfg {
  files?: ChartEditorFile[];
  /** Injected: the source file's column names — `columns({ fileId })`. */
  columns: Source<string[]>;
  /** Injected: the aggregated preview rows — `preview({ fileId, groupBy, aggCol,
      aggFn })`; each row is [groupKey, …, aggregate]. */
  preview: Source<unknown[][]>;
  initial?: ChartEditorInitial;
  /** Override the measure functions (default: count/sum/mean/min/max/distinct). */
  aggFns?: AggFn[];
  /** Notified with the recipe after every successful preview. */
  onChange?: (recipe: ChartRecipe) => void;
}

export interface ChartEditorHandle extends MountHandle {
  getPayload: () => ChartPayload;
  getOption: () => BakedOption | null;
  valid: () => boolean;
}

const DEFAULT_AGG_FNS: AggFn[] = [
  ["count", "Count"],
  ["sum", "Sum"],
  ["mean", "Average"],
  ["min", "Min"],
  ["max", "Max"],
  ["count_distinct", "Distinct"],
];

/** The internal live chart cfg (a ChartCfg plus the data binding the editor owns). */
interface EditorCfg extends ChartCfg {
  group_by: string;
  agg_fn: string;
  agg_col: string;
}

export function mountChartEditor(host: Element, cfg: ChartEditorCfg): ChartEditorHandle {
  const files = cfg.files ?? [];
  const aggFns = cfg.aggFns ?? DEFAULT_AGG_FNS;

  // The live chart cfg (the spec we persist). Seeded from `initial.spec` when editing.
  const c: EditorCfg = {
    kind: "cartesian",
    type: "bar",
    theme: chartTheme(),
    legend: true,
    legendPos: "top",
    tooltip: true,
    axisLine: true,
    splitLines: true,
    group_by: "",
    agg_fn: "count",
    agg_col: "",
    option: null,
    ...(cfg.initial?.spec ?? {}),
  };
  let sourceId = cfg.initial?.source_file_id || files[0]?.rid || "";
  let title = cfg.initial?.title ?? "";
  let columns: string[] = []; // the source file's columns
  let inst: EChartsInstance | null = null; // the preview ECharts instance
  let seq = 0; // guards rapid edits racing their preview

  const root = el("div", { class: "amu-ce" });
  const form = el("div", { class: "amu-ce-form" });
  const preview = el("div", { class: "amu-ce-preview" });
  root.append(form, preview);
  host.append(root);

  const field = (label: string, controlHost: HTMLElement): HTMLElement =>
    el("label", { class: "amu-ce-field" }, el("span", { class: "amu-ce-label" }, label), controlHost);

  // ── controls ────────────────────────────────────────────────────────────────
  const titleHost = el("span");
  titleHost.append(
    input({
      placeholder: "Chart title",
      value: title,
      onInput: (v) => {
        title = v;
      },
    }),
  );

  const sourceHost = el("span");
  const typeHost = el("span");
  const groupHost = el("span");
  const fnHost = el("span");
  const colHost = el("span");
  const themeHost = el("span");

  mountSelect(sourceHost, {
    options: files.map((f) => ({ value: f.rid, label: f.filename })),
    value: sourceId,
    onChange: async (v) => {
      sourceId = v;
      await loadColumns();
      refreshDataControls();
      void rebuild();
    },
  });
  mountSelect(typeHost, {
    options: TYPE_LIST.map(([t, , label]) => ({ value: t, label })),
    value: c.type ?? "bar",
    onChange: (v) => {
      c.type = v;
      c.kind = TYPE_TO_KIND[v] ?? "cartesian";
      void rebuild();
    },
  });
  mountSelect(themeHost, {
    options: Object.entries(THEMES).map(([k, t]) => ({ value: k, label: t.name })),
    value: c.theme ?? "",
    onChange: (v) => {
      c.theme = v;
      void rebuild();
    },
  });

  form.append(
    field("Title", titleHost),
    field("Source file", sourceHost),
    field("Chart type", typeHost),
    field("Group by", groupHost),
    field("Measure", fnHost),
    field("Of column", colHost),
    field("Theme", themeHost),
  );

  // Group-by + agg-col selects are rebuilt whenever the source's columns change.
  function refreshDataControls(): void {
    groupHost.replaceChildren();
    colHost.replaceChildren();
    fnHost.replaceChildren();
    const colOpts = columns.map((k) => ({ value: k, label: k }));
    if (!columns.includes(c.group_by)) c.group_by = columns[0] ?? "";
    if (!columns.includes(c.agg_col)) c.agg_col = columns[0] ?? "";
    mountSelect(groupHost, {
      options: colOpts,
      value: c.group_by,
      onChange: (v) => {
        c.group_by = v;
        void rebuild();
      },
    });
    mountSelect(fnHost, {
      options: aggFns.map(([v, l]) => ({ value: v, label: l })),
      value: c.agg_fn,
      onChange: (v) => {
        c.agg_fn = v;
        void rebuild();
      },
    });
    mountSelect(colHost, {
      options: colOpts,
      value: c.agg_col,
      onChange: (v) => {
        c.agg_col = v;
        void rebuild();
      },
    });
  }

  async function loadColumns(): Promise<void> {
    if (!sourceId) {
      columns = [];
      return;
    }
    try {
      columns = (await cfg.columns({ fileId: sourceId })) ?? [];
    } catch {
      columns = [];
    }
  }

  // The PERSISTABLE recipe — the chart DEFINITION minus the baked `option`. The
  // option carries the aggregated result (group keys = raw cell values +
  // aggregates) — customer-derived data that must NEVER reach the persisted spec
  // (derive, don't store). source_file_id + group_by/agg/type/theme RE-DERIVE the
  // option on render, so it stays client-only.
  const recipe = (): ChartRecipe => {
    const { option, ...rest } = c;
    void option;
    return rest;
  };

  // ── live preview: aggregate via the injected source → shape → renderChart ────
  async function rebuild(): Promise<void> {
    const my = ++seq;
    if (!sourceId || !c.group_by) return;
    // count = rows-per-group (no measure column needed); others need agg_col.
    const aggCol = c.agg_fn === "count" ? c.group_by : c.agg_col;
    if (!aggCol) return;
    let rows: unknown[][];
    try {
      rows =
        (await cfg.preview({
          fileId: sourceId,
          groupBy: c.group_by,
          aggCol,
          aggFn: c.agg_fn,
        })) ?? [];
    } catch {
      return;
    }
    if (my !== seq) return;
    // first column = the group key; last = the aggregation.
    const data = rows.map((r) => ({
      name: String(r[0]),
      value: Number(r[r.length - 1]) || 0,
    }));
    c.option = synthesizeOption(data, c.kind);
    inst?.dispose();
    inst = renderChart(preview, { cfg: c }, c.theme);
    cfg.onChange?.(recipe());
  }

  // initial load + first preview
  void (async () => {
    await loadColumns();
    refreshDataControls();
    await rebuild();
  })();

  return {
    el: root,
    /** The shape the consumer persists — the recipe only, NO baked option
        (customer-derived data never reaches the persisted spec). */
    getPayload: () => ({ source_file_id: sourceId, title: title.trim(), spec: recipe() }),
    /** The live (client-side) synthesized option — lets the consumer render the
        just-authored tile immediately, no round-trip. Never persisted. */
    getOption: () => c.option ?? null,
    valid: () => !!(sourceId && title.trim() && c.group_by),
    destroy: () => {
      inst?.dispose();
      root.remove();
    },
  };
}
