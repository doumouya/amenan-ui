/* dashboard-grid — a designer canvas: a cols×rows grid (default 15×10, a 3:2
   screen → square cells) where each element is placed by `{x,y,w,h}` (cell
   coords, 0-based). View mode renders the elements; editable mode adds drag-move
   + SE-resize (both snap to whole cells, clamped to the canvas) and a remove
   affordance, firing onLayoutChange after each commit. Sole owner of `.amu-dg-*`.
   The per-cell grid placement is geometry (`.style.grid*`) — kept out of app
   code, which composes this and never touches `.style`.

   mountDashboardGrid(host, { cols?, rows?, elements:[{id,x,y,w,h,mount(body)→h?}],
     editable?, onLayoutChange?(layout), onRemove?(id) })
   → { el, getLayout(), addElement(e), removeElement(id), setEditable(b),
       update({elements}), destroy } */

import { el } from "../../kernel/dom.ts";
import type { MountHandle } from "../../contract/index.ts";

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** A placed element. `x,y,w,h` are whole-cell coords (0-based origin). */
export interface DashboardElement {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Builds the element's body; the returned handle is torn down on remove. */
  mount?: (body: HTMLElement) => MountHandle | void;
}

/** A bare layout record (no mount fn) — what getLayout()/onLayoutChange emit. */
export interface DashboardLayoutItem {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DashboardGridCfg {
  cols?: number;
  rows?: number;
  elements?: DashboardElement[];
  editable?: boolean;
  onLayoutChange?: (layout: DashboardLayoutItem[]) => void;
  onRemove?: (id: string) => void;
}

export interface DashboardGridUpdate {
  elements?: DashboardElement[];
}

export interface DashboardGridHandle extends MountHandle<DashboardGridUpdate> {
  getLayout: () => DashboardLayoutItem[];
  addElement: (e: Partial<DashboardElement> & { id: string }) => DashboardElement;
  removeElement: (id: string) => void;
  setEditable: (next: boolean) => void;
}

interface CellRec {
  e: DashboardElement;
  cell: HTMLElement;
  handle: MountHandle | null;
}

export function mountDashboardGrid(host: Element, cfg: DashboardGridCfg = {}): DashboardGridHandle {
  const cols = cfg.cols || 15;
  const rows = cfg.rows || 10;
  let editable = !!cfg.editable;
  const onLayoutChange = cfg.onLayoutChange;
  const onRemove = cfg.onRemove;

  const grid = el("div", { class: "amu-dg" });
  grid.style.setProperty("--dg-cols", String(cols));
  grid.style.setProperty("--dg-rows", String(rows));
  grid.classList.toggle("is-editable", editable);
  host.append(grid);

  // id → { e, cell, handle }  (e is the live {id,x,y,w,h,mount} record)
  const cells = new Map<string, CellRec>();

  const cellW = (): number => grid.clientWidth / cols;
  const cellH = (): number => grid.clientHeight / rows;
  const place = (cell: HTMLElement, e: DashboardElement): void => {
    cell.style.gridColumn = `${e.x + 1} / span ${e.w}`;
    cell.style.gridRow = `${e.y + 1} / span ${e.h}`;
  };
  const commit = (): void => onLayoutChange?.(getLayout());

  function renderCell(e: DashboardElement): void {
    const cell = el("div", { class: "amu-dg-cell", "data-dg-id": e.id });
    place(cell, e);
    const body = el("div", { class: "amu-dg-cell-body" });
    cell.append(body);
    if (editable) {
      const bar = el(
        "div",
        { class: "amu-dg-cell-bar" },
        el("span", { class: "amu-dg-grip", title: "Drag to move" }),
        el(
          "button",
          {
            class: "amu-dg-del",
            type: "button",
            title: "Remove",
            onclick: () => {
              removeElement(e.id);
              onRemove?.(e.id);
            },
          },
          "×",
        ),
      );
      cell.append(bar, el("span", { class: "amu-dg-resize", title: "Drag to resize" }));
      wireDrag(cell, e, bar);
      wireResize(cell, e);
    }
    grid.append(cell);
    const handle = e.mount ? e.mount(body) ?? null : null;
    cells.set(e.id, { e, cell, handle });
  }

  // Drag-move: grab the bar (not the body) → translate the pointer delta into
  // whole-cell steps, clamp to the canvas, re-place live, commit on release.
  function wireDrag(cell: HTMLElement, e: DashboardElement, grabEl: HTMLElement): void {
    grabEl.addEventListener("pointerdown", (ev) => {
      if ((ev.target as Element | null)?.closest(".amu-dg-del")) return;
      ev.preventDefault();
      const sx = ev.clientX;
      const sy = ev.clientY;
      const ox = e.x;
      const oy = e.y;
      const cw = cellW();
      const ch = cellH();
      const move = (m: PointerEvent): void => {
        e.x = clamp(ox + Math.round((m.clientX - sx) / cw), 0, cols - e.w);
        e.y = clamp(oy + Math.round((m.clientY - sy) / ch), 0, rows - e.h);
        place(cell, e);
      };
      const up = (): void => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        cell.classList.remove("is-dragging");
        commit();
      };
      cell.classList.add("is-dragging");
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    });
  }

  // SE-resize: grab the corner handle → grow/shrink w/h in whole cells, min 1×1,
  // clamped so the element stays inside the canvas.
  function wireResize(cell: HTMLElement, e: DashboardElement): void {
    const handle = cell.querySelector(".amu-dg-resize");
    handle?.addEventListener("pointerdown", (ev) => {
      const p = ev as PointerEvent;
      p.preventDefault();
      p.stopPropagation();
      const sx = p.clientX;
      const sy = p.clientY;
      const ow = e.w;
      const oh = e.h;
      const cw = cellW();
      const ch = cellH();
      const move = (m: PointerEvent): void => {
        e.w = clamp(ow + Math.round((m.clientX - sx) / cw), 1, cols - e.x);
        e.h = clamp(oh + Math.round((m.clientY - sy) / ch), 1, rows - e.y);
        place(cell, e);
      };
      const up = (): void => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        cell.classList.remove("is-resizing");
        commit();
      };
      cell.classList.add("is-resizing");
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    });
  }

  function getLayout(): DashboardLayoutItem[] {
    return [...cells.values()].map(({ e }) => ({ id: e.id, x: e.x, y: e.y, w: e.w, h: e.h }));
  }

  function addElement(e: Partial<DashboardElement> & { id: string }): DashboardElement {
    const rec: DashboardElement = { x: 0, y: 0, w: 3, h: 2, ...e };
    renderCell(rec);
    commit();
    return rec;
  }

  function removeElement(id: string): void {
    const c = cells.get(id);
    if (!c) return;
    c.handle?.destroy?.();
    c.cell.remove();
    cells.delete(id);
    commit();
  }

  function setEditable(next: boolean): void {
    editable = !!next;
    grid.classList.toggle("is-editable", editable);
    // Re-render so the edit chrome (bar/handles + listeners) appears/clears.
    const snapshot = [...cells.values()].map(({ e }) => e);
    cells.forEach(({ cell }) => cell.remove());
    cells.clear();
    snapshot.forEach(renderCell);
  }

  (cfg.elements ?? []).forEach((e) => renderCell({ ...e }));

  return {
    el: grid,
    getLayout,
    addElement,
    removeElement,
    setEditable,
    update: (p: DashboardGridUpdate = {}) => {
      if (p.elements) {
        cells.forEach(({ cell, handle }) => {
          handle?.destroy?.();
          cell.remove();
        });
        cells.clear();
        p.elements.forEach((e) => renderCell({ ...e }));
      }
    },
    destroy: () => {
      cells.forEach(({ handle }) => handle?.destroy?.());
      grid.remove();
    },
  };
}
