/* responsive.ts — device-class + breakpoint signals via matchMedia (AC-19, ported
   from web-kit's responsive.ts to the amenan kernel).

   Width alone misclassifies devices — a landscape phone is wide-but-short, and a
   narrow desktop window is not a phone — so `device()` combines pointer/hover with
   the SHORT viewport dimension. Prefer fluid CSS (clamp/@container/@media) for
   layout; reach for this only when BEHAVIOUR (not just style) must change.

   The numeric `BREAKPOINTS` px values are the JS source of truth; base.css's
   `--bp-lg`/`--bp-md`/`--bp-sm` rem tokens are the CSS one. They intentionally
   describe the same device ladder from the two sides of the JS↔CSS boundary:
     --bp-lg 80rem (1280px) ≈ BREAKPOINTS["2xl"] (1280) — laptops/desktops
     --bp-md 64rem (1024px) ≈ BREAKPOINTS.xl (1024)     — tablets landscape / floor
     --bp-sm 48rem  (768px) ≈ BREAKPOINTS.lg (768)      — tablets portrait
   The finer-grained xs/sm/md (360/480/600) are JS-only signals with no CSS token.

   No DOM/identity coupling — pure matchMedia + innerWidth/innerHeight reads. */

/** The behavioural device class. */
export type Device = "phone" | "tablet" | "desktop";
/** A width-band name (`base` is below the smallest threshold). */
export type Breakpoint = "base" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

/** Min-width thresholds (CSS px), aligned to real device logical viewports. */
export const BREAKPOINTS = {
  xs: 360, // phones (most Android/iPhone 360–430)
  sm: 480, // large phones / narrow landscape
  md: 600, // small tablets portrait / Fold-inner edge
  lg: 768, // tablets portrait (iPad 744–834) / Fold unfolded
  xl: 1024, // tablets landscape / iPad Pro 12.9 / small laptops
  "2xl": 1280, // laptops & desktops
} as const;

const mq = (query: string): boolean =>
  typeof matchMedia === "function" ? matchMedia(query).matches : false;

/** The current width breakpoint name. */
export function breakpoint(width: number = globalThis.innerWidth ?? 0): Breakpoint {
  if (width >= BREAKPOINTS["2xl"]) return "2xl";
  if (width >= BREAKPOINTS.xl) return "xl";
  if (width >= BREAKPOINTS.lg) return "lg";
  if (width >= BREAKPOINTS.md) return "md";
  if (width >= BREAKPOINTS.sm) return "sm";
  if (width >= BREAKPOINTS.xs) return "xs";
  return "base";
}

/** A short viewport: a landscape phone, or a split/tiny window. */
export function isShort(): boolean {
  return mq("(max-height: 480px)");
}

/** A touch device (coarse pointer / no hover), regardless of width. */
export function isTouch(): boolean {
  return mq("(pointer: coarse)") || mq("(hover: none)");
}

/** The viewport is split into two segments by a fold/hinge (book mode). */
export function isFolded(): boolean {
  return mq("(horizontal-viewport-segments: 2)") || mq("(vertical-viewport-segments: 2)");
}

/** The device class. A touch device whose SHORT dimension is under ~600 CSS px is
    a phone (this catches a landscape phone that is wide but short); a larger touch
    device is a tablet; anything with a fine pointer + hover is a desktop, even in a
    narrow window. */
export function device(): Device {
  if (!isTouch()) return "desktop";
  const shortSide = Math.min(globalThis.innerWidth ?? 0, globalThis.innerHeight ?? 0);
  return shortSide < BREAKPOINTS.md ? "phone" : "tablet";
}

/** Subscribe to width/orientation changes (debounced to the next frame). Returns a
    cleanup function; pass an `AbortSignal` to auto-remove on teardown. */
export function onChange(callback: () => void, signal?: AbortSignal): () => void {
  let frame = 0;
  const handler = (): void => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(callback);
  };
  const opts: AddEventListenerOptions = signal ? { signal } : {};
  addEventListener("resize", handler, opts);
  addEventListener("orientationchange", handler, opts);
  return () => {
    removeEventListener("resize", handler);
    removeEventListener("orientationchange", handler);
  };
}
