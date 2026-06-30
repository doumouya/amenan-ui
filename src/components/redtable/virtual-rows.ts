/* virtual-rows — internal windowing util for redtable (NOT a registered
   component). Keeps ~40 <tr> in the DOM regardless of row count; two spacer
   rows keep the scrollbar honest. The renderRow callback must be a pure
   synchronous element builder (the scroll hot loop).
   NOTE: inline style writes here are sanctioned measured-geometry (the scroll
   spacer heights are computed, not theme-able). */

const WINDOW = 40;
const OVERSCAN = 10;

export interface VirtualRowsCfg {
  scrollHost: HTMLElement;
  tbody: HTMLElement;
  rowCount: number;
  rowHeight: number;
  renderRow: (i: number) => Node;
}

export interface VirtualRowsHandle {
  repaint: () => void;
  setCount: (n: number) => void;
  destroy: () => void;
}

export function createVirtualRows({
  scrollHost,
  tbody,
  rowCount,
  rowHeight,
  renderRow,
}: VirtualRowsCfg): VirtualRowsHandle {
  const topSpacer = document.createElement("tr");
  const bottomSpacer = document.createElement("tr");
  const topCell = document.createElement("td");
  const bottomCell = document.createElement("td");
  topSpacer.appendChild(topCell);
  bottomSpacer.appendChild(bottomCell);
  for (const cell of [topCell, bottomCell]) {
    cell.colSpan = 999;
    cell.style.padding = "0";
    cell.style.border = "0";
  }

  let count = rowCount;

  function paint(): void {
    const scrollTop = scrollHost.scrollTop;
    const first = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN);
    const last = Math.min(count, first + WINDOW + OVERSCAN * 2);

    topCell.style.height = `${first * rowHeight}px`;
    bottomCell.style.height = `${Math.max(0, (count - last) * rowHeight)}px`;

    const frag = document.createDocumentFragment();
    frag.append(topSpacer);
    for (let i = first; i < last; i++) frag.append(renderRow(i));
    frag.append(bottomSpacer);
    tbody.replaceChildren(frag);
  }

  let raf = 0;
  function onScroll(): void {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      paint();
    });
  }
  scrollHost.addEventListener("scroll", onScroll, { passive: true });
  paint();

  return {
    repaint: paint,
    setCount(n: number): void {
      count = n;
      paint();
    },
    destroy(): void {
      scrollHost.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    },
  };
}
