import type { ExtensionAPI, ThemeColor } from "@earendil-works/pi-coding-agent";
import { matchesKey, visibleWidth } from "@earendil-works/pi-tui";

const TICK_MS = 250; // ~4 fps, smooth animation (overlay avoids flicker)
const overlayHeight = 0.85;

// Color and style helpers
const clear = "\x1b[0m";
export const orangeRed = (s: string) => `\x1b[38;2;255;69;0m${s}${clear}`;   // outter-flame
export const darkOrange = (s: string) => `\x1b[38;2;255;140;0m${s}${clear}`; // inner-flame
const gray = (s: string) => `\x1b[38;2;100;100;100m${s}${clear}`;

// Block
export const block = "\u2588";

/**
 * Reimplementation of emacs-fireplace flame animation for pi.
 *
 * Original algorithm in fireplace.el:
 *  - Multiple flames positioned by relative X positions (fireplace-flame-pos)
 *  - Each flame is a triangle: lower widens down, upper narrows with flicker
 *  - Two-layer coloring: outer (orange red) + inner core (dark orange)
 *  - Optional smoke particles (*) rising above flames
 *  - Background fills with spaces; grid is redrawn each frame
 */

// Default flame X positions (relative 0..1 across width) from original
const DEFAULT_FLAME_POS = [0.25, 0.36, 0.5, 0.64, 0.75];

/** Pad a line with trailing spaces to reach width w. */
function padLine(line: string, w: number): string {
  const contentLen = visibleWidth(line);
  return line + " ".repeat(Math.max(0, w - contentLen));
}

/** Center a string within width w. */
function center(s: string, w: number): string {
  const contentLen = visibleWidth(s);
  const pad = Math.max(0, w - contentLen);
  const left = Math.floor(pad / 2);
  const right = pad - left;
  return " ".repeat(left) + s + " ".repeat(right);
}
class FireplaceComponent {
  // Animation timer
  #interval: ReturnType<typeof setInterval> | null = null;

  // Callbacks
  readonly #onClose: () => void;
  readonly #theme: { fg: (color: ThemeColor, text: string) => string };
  readonly #tui: { requestRender: () => void; terminal: { rows: number; columns: number } };

  // Caching
  #cachedLines: string[] = [];
  #cachedWidth = 0;
  private version = 0;
  #cachedVersion = -1;

  // Config (mirrors fireplace.el customs)
  #smokeOn = false;                       // fireplace-smoke-on
  readonly flamePos = [...DEFAULT_FLAME_POS];     // fireplace-flame-pos

  // Precompute per-frame random state for flicker
  // Seed per tick using version so results are stable within frame
  #rnd = (n: number) => Math.abs((Math.sin(this.version * 12.9898 + n) * 43758.5453) % 1); // 0..1

  /** Set a grid cell if coordinates are in bounds. */
  private setCell(grid: string[][], gx: number, gy: number, value: string): void {
    if (!grid?.length || !grid[0]?.length) return;
    if (gx < 0 || gx >= grid[0].length || gy < 0 || gy >= grid.length) return;
    grid[gy][gx] = value;
  }

  constructor(
    tui: { requestRender: () => void; terminal: { rows: number; columns: number } },
    theme: { fg: (color: ThemeColor, text: string) => string },
    onClose: () => void,
  ) {
    this.#tui = tui;
    this.#theme = theme;
    this.#onClose = onClose;
    this.startAnimation();
  }

  /* ------------------------------------------------------------------ */
  /*  Animation loop                                                     */
  /* ------------------------------------------------------------------ */

  private startAnimation(): void {
    this.#interval = setInterval(() => {
      this.version++;
      this.#tui.requestRender();
    }, TICK_MS);
  }

  /** @public called by the overlay on close, and by tests for cleanup */
  dispose(): void {
    if (this.#interval) {
      clearInterval(this.#interval);
      this.#interval = null;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Keyboard handling                                                  */
  /* ------------------------------------------------------------------ */

  handleInput(data: string): void {
    if (matchesKey(data, "escape") || data === "q" || data === "Q") {
      this.dispose();
      this.#onClose();
      return;
    }
    if (data === "s" || data === "S") {
      this.#smokeOn = !this.#smokeOn;
      this.version++; // force immediate rerender to show change
      this.#tui.requestRender();
      return;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Invalidation                                                       */
  /* ------------------------------------------------------------------ */

  invalidate(): void {
    this.#cachedWidth = 0;
    this.#cachedVersion = -1;
  }

  /** Set a deterministic version for testing. */
  setVersion(v: number): void {
    this.version = v;
  }

  drawFlame(flameIndex: number, flameWidthBase: number, gridW: number, gridH: number, grid: string[][]){

      const relX = this.flamePos[flameIndex];
      const mid = Math.floor(relX * gridW);

      // Flame height with a little randomness for life
      // Guard against out-of-range flame index
      if (flameIndex < 0 || flameIndex >= this.flamePos.length) return;

      const flameHeight = flameWidthBase + Math.floor((this.#rnd(flameIndex + 7) - 0.5) * 4);
      if (flameHeight <= 2) return;

      const lower = Math.floor(flameHeight * 0.2);
      const high = flameHeight - lower;

      // Starting width tapers up the flame
      let width = flameHeight;

      // Lower widening section (flames spread near base)
      for (let y = 0; y < lower; y++) {
        width = width + y;
        let x = mid - Math.floor(width / 2);
        if (x < 0) {
          width += x;
          x = 0;
        }
        if (x + width > gridW) width = gridW - x;

        // outer band
        for (let i = 0; i < width; i++) {
          const gx = x + i;
          if (gx < 0 || gx >= gridW || y >= gridH) continue;
          const gy = gridH - 2 - y;
          if (gy < 0 || gy >= gridH) continue;
          // Single-cell tip should be darkOrange
          grid[gy][gx] = (width === 1 ? darkOrange : orangeRed)(block);
        }
        // inner core (narrower)
        const hotCore = Math.floor(width / 2);
        if (hotCore >= 1) {
          const cx = x + Math.floor((width - hotCore) / 2);
          for (let i = 0; i < hotCore; i++) {
            const gx = cx + i;
            if (gx < 0 || gx >= gridW || y >= gridH) continue;
            const gy = gridH - 2 - y;
            if (gy < 0 || gy >= gridH) continue;
            grid[gy][gx] = darkOrange(block);
          }
        }
      }

      // Upper flickering section
      let lineY = lower;
      let tipDrawn = false;
      for (let y = 0; y < high && !tipDrawn; y++) {
        lineY = lower + y;
        // Random narrowing + flicker
        width = width - 1 - Math.floor(this.#rnd(y + flameIndex * 10 + this.version) * 3);
        // Snap to 1 whenever width drops to 3 or below
        if (width <= 3) {
          width = 1;
          tipDrawn = true;
        }
        let x = mid - Math.floor(width / 2);
        if (x < 0) {
          width += x;
          x = 0;
        }
        if (x + width > gridW) width = gridW - x;

        // outer
        for (let i = 0; i < width; i++) {
          const gx = x + i;
          if (gx < 0 || gx >= gridW || lineY >= gridH) continue;
          const gy = gridH - 2 - lineY;
          if (gy < 0 || gy >= gridH) continue;
          // Single-cell tip should be darkOrange
          grid[gy][gx] = (width === 1 ? darkOrange : orangeRed)(block);
        }
        // inner core
        const hotCore = Math.floor(width / 2);
        if (hotCore >= 1) {
          const cx = x + Math.floor((width - hotCore) / 2);
          for (let i = 0; i < hotCore; i++) {
            const gx = cx + i;
            if (gx < 0 || gx >= gridW || lineY >= gridH) continue;
            const gy = gridH - 2 - lineY;
            if (gy < 0 || gy >= gridH) continue;
            grid[gy][gx] = darkOrange(block);
          }
        }

        // Stop once we've drawn the tip (width=1)
        if (tipDrawn) break;

        // optional smoke
        if (this.#smokeOn) {
          // Occasionally emit a smoke char above the flame tip
          if (this.#rnd(y * 31 + flameIndex) < 0.35) {
            const smokeX = x + Math.floor(this.#rnd(y + 99) * Math.max(1, width));
            const flameRow = gridH - 2 - lineY;
            const smokeY = flameRow - 1 - Math.floor(this.#rnd(y + 123) * Math.max(1, flameRow - 1));
            if (smokeX >= 0 && smokeX < gridW && smokeY >= 0 && smokeY < gridH) {
              if (grid[smokeY][smokeX] === " ") {
                grid[smokeY][smokeX] = gray("*");
              }
            }
          }
        }
      }

      // Post-loop guard: if loop exhausted without hitting ≤3, draw tip row
      if (!tipDrawn && width > 1) {
        lineY = lower + high;
        width = 1;
        let x = mid - Math.floor(width / 2);
        if (x < 0) { width += x; x = 0; }
        if (x + width > gridW) width = gridW - x;
        const gy = gridH - 2 - lineY;
        if (gy >= 0 && gy < gridH && x >= 0 && x < gridW) {
          grid[gy][x] = darkOrange(block);
        }
      }
  }


  /* ------------------------------------------------------------------ */
  /*  Rendering                                                          */
  /* ------------------------------------------------------------------ */

  render(width: number): string[] {
    if (width === this.#cachedWidth && this.#cachedVersion === this.version) {
      return this.#cachedLines;
    }

    // Guard: terminal too small — return empty content so the TUI
    // overlay doesn't crash on a degenerate grid.
    if (this.#tui.terminal.rows < 10 || this.#tui.terminal.columns < 20) {
      this.#cachedLines = [];
      this.#cachedWidth = width;
      this.#cachedVersion = this.version;
      return [];
    }

    // padLine and center are defined at module level

    // ---- terminal dimensions ----
    // In an overlay ~85% of the terminal is available; use a conservative
    // fraction so the footer + box-bottom stay on screen.
    const overlayRows = Math.floor(this.#tui.terminal.rows * overlayHeight);
    const termRows = Math.max(10, overlayRows - 6);
    const termCols = Math.max(20, width - 2);
    const lines: string[] = [];

    // ---- background grid (like fireplace--make-grid) ----
    // We'll draw a bordered firebox area
    const boxTop = "┌" + "─".repeat(termCols) + "┐";
    const boxBottom = "└" + "─".repeat(termCols) + "┘";

    lines.push(center(boxTop, width));

    // Flame configuration (mirrors fireplace--update-locals-vars)
    const flameWidthBase = Math.min(termRows, Math.floor(termCols / 2.5));

    // We will composite onto a char grid first (spaces + colored blocks)
    const gridH = termRows;
    const gridW = termCols;
    // Each cell stores a colored string segment or plain space
    const grid: string[][] = Array.from({ length: gridH }, () => Array(gridW).fill(" "));

    // Height scale based on index: center flame is tallest,
    // flames further from center are gradually shorter
    const maxDist = this.flamePos.length / 2;

    for (let flameIndex = 0; flameIndex < this.flamePos.length; flameIndex++) {
      const distFromCenter = Math.abs(flameIndex - (this.flamePos.length - 1) / 2);
      const heightScale = 1.0 - (distFromCenter / maxDist) * 0.5;
      const scaledBase = Math.max(2, Math.floor(flameWidthBase * heightScale));
      this.drawFlame(flameIndex, scaledBase, gridW, gridH, grid);
    }

    // Convert grid rows to colored lines and box them
    for (let y = 0; y < gridH; y++) {
      let row = "";
      for (let x = 0; x < gridW; x++) {
        row += grid[y][x];
      }
      const boxed = "│" + row + "│";
      lines.push(padLine(center(boxed, width), width));
    }

    lines.push(center(boxBottom, width));

    // Bottom controls
    lines.push("");
    const t = this.#theme;
    const smokeLabel = this.#smokeOn
      ? `${t.fg("accent", "S")} ${t.fg("muted", "smoke:ON")}`
      : `${t.fg("accent", "S")} ${t.fg("muted", "smoke:OFF")}`;
    const footer =
      t.fg("dim", "[") + smokeLabel + t.fg("dim", " · ") +
      `${t.fg("accent", "Q")} ${t.fg("muted", "quit")}${t.fg("dim", " · ")}${t.fg("accent", "Esc")} ${t.fg("muted", "exit")}` +
      t.fg("dim", "]");
    lines.push(padLine(center(footer, width), width));

    // No vertical centering padding — the overlay handles positioning.
    this.#cachedLines = lines;
    this.#cachedWidth = width;
    this.#cachedVersion = this.version;
    return lines;
  }
}

// Export for testing
export { FireplaceComponent };

/* -------------------------------------------------------------------- */
/*  Extension entry point                                                */
/* -------------------------------------------------------------------- */

export default function (pi: ExtensionAPI): void {
  pi.registerCommand("fireplace", {
    description: "Display a cozy fireplace with animated flames (reimplementation of emacs fireplace.el).",
    handler: async (_args, ctx) => {
      if (ctx.mode !== "tui") {
        ctx.ui.notify("Fireplace requires interactive (TUI) mode", "error");
        return;
      }

      try {
        await ctx.ui.custom((tui, theme, _kb, done) => {
          // Guard: terminal too small → shut down gracefully
          if (tui.terminal.rows < 15 || tui.terminal.columns < 30) {
            ctx.ui.notify("Terminal too small for fireplace", "warning");
            done(undefined);
            return { render: () => [], invalidate() {} };
          }
          return new FireplaceComponent(tui, theme, () => done(undefined));
        },
        {
          overlay: true,
          overlayOptions: {
            width: "80%",
            maxHeight: `${overlayHeight * 100}%`,
            anchor: "center",
          },
        },
      );
      } catch {
        ctx.ui.notify("Failed to start fireplace", "error");
      }
    },
  });
}
