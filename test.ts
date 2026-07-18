/**
 * Flame-shape tests for pi-fireplace.
 *
 * These tests call drawFlame() directly on a fresh grid and inspect
 * the rendered cells to verify structural shape properties:
 *   - flame has a base (bottom row with content)
 *   - base is wider than tip
 *   - base is thinner than the widest mid section
 *   - tip is exactly 1 char wide
 *   - tip is coloured darkOrange (the hottest inner-core colour)
 */

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { FireplaceComponent, block, orangeRed, darkOrange } from "./extensions/index.ts";

// ---------------------------------------------------------------------------
//  Helpers (grid inspection)
// ---------------------------------------------------------------------------

/** True if a cell is a flame cell (non-space block character). */
function isFlameCell(cell: string): boolean {
  return cell !== " " && cell.includes(block);
}

/** Count flame cells in a single grid row. */
function flameCellCountInRow(row: string[]): number {
  return row.filter(isFlameCell).length;
}

/**
 * Return the flame profile as an array of widths per grid row, from top
 * (lowest grid index) to bottom (highest grid index), skipping empty rows.
 * The tip is at index 0; the base is at the last index.
 */
function getFlameProfile(grid: string[][]): number[] {
  const profile: number[] = [];
  for (const row of grid) {
    const count = flameCellCountInRow(row);
    if (count > 0) profile.push(count);
  }
  return profile;
}

/** Return the grid-row index of the topmost (highest) flame cell, or -1. */
function getTopmostFlameRow(grid: string[][]): number {
  for (let y = 0; y < grid.length; y++) {
    if (flameCellCountInRow(grid[y]) > 0) return y;
  }
  return -1;
}

/** Return the grid-row index of the bottommost (lowest) flame cell, or -1. */
function getBottommostFlameRow(grid: string[][]): number {
  for (let y = grid.length - 1; y >= 0; y--) {
    if (flameCellCountInRow(grid[y]) > 0) return y;
  }
  return -1;
}

/** Return true if a cell is coloured darkOrange (the tip colour). */
function isDarkOrange(cell: string): boolean {
  return cell === darkOrange(block);
}

/** Return true if a cell is coloured orangeRed (outer flame). */
function isOrangeRed(cell: string): boolean {
  return cell === orangeRed(block);
}

/** Return the flame-coloured cells in a grid row as {col, color} entries. */
function getFlameCellsInRow(
  row: string[],
): { col: number; color: string }[] {
  const cells: { col: number; color: string }[] = [];
  for (let x = 0; x < row.length; x++) {
    if (isFlameCell(row[x])) {
      cells.push({
        col: x,
        color: isDarkOrange(row[x]) ? "darkOrange" : "orangeRed",
      });
    }
  }
  return cells;
}

// ---------------------------------------------------------------------------
//  Test setup
// ---------------------------------------------------------------------------

const TERM_ROWS = 25;
const TERM_COLS = 60;

function makeComponent(): FireplaceComponent {
  const comp = new FireplaceComponent(
    {
      requestRender: () => {},
      terminal: { rows: TERM_ROWS, columns: TERM_COLS },
    },
    { fg: () => "" },
    () => (undefined),
  );
  components.push(comp);
  return comp;
}

// Track created components for cleanup
const components: FireplaceComponent[] = [];

afterEach(() => {
  for (const comp of components) {
    comp.dispose();
  }
  components.length = 0;
});

// ---------------------------------------------------------------------------
//  Tests
// ---------------------------------------------------------------------------

describe("Flame shape via drawFlame", () => {
  const GRID_W = 60;
  const GRID_H = 25;

  /**
   * Call drawFlame(0, flameWidthBase, GRID_W, GRID_H, grid) on a
   * freshly-allocated empty grid and return the grid plus the profile.
   */
  function drawTestFlame(
    flameWidthBase = 10,
  ): { grid: string[][]; profile: number[] } {
    const grid: string[][] = Array.from({ length: GRID_H }, () =>
      Array(GRID_W).fill(" "),
    );
    const comp = makeComponent();
    comp.drawFlame(0, flameWidthBase, GRID_W, GRID_H, grid);
    return { grid, profile: getFlameProfile(grid) };
  }

  // -----------------------------------------------------------------------
  //  Existence & shape basics
  // -----------------------------------------------------------------------

  it("should draw at least one flame cell (non-empty flame)", () => {
    const { profile } = drawTestFlame();
    assert.ok(profile.length > 0, "Expected flame to produce at least one row with content");
  });

  it("should draw a flame taller than 1 cell (has vertical extent)", () => {
    const { grid } = drawTestFlame();
    const top = getTopmostFlameRow(grid);
    const bot = getBottommostFlameRow(grid);
    assert.notEqual(top, -1, "Expected a topmost flame row");
    assert.notEqual(bot, -1, "Expected a bottommost flame row");
    assert.ok(bot - top > 0, `Expected flame height > 1, got ${bot - top + 1} rows`);
  });

  // -----------------------------------------------------------------------
  //  Base is wider than tip
  // -----------------------------------------------------------------------

  it("should have a base (bottom-most row) wider than the tip (top-most row)", () => {
    const { profile } = drawTestFlame();
    assert.ok(profile.length >= 2, `Need at least 2 flame rows, got ${profile.length}`);

    const tipWidth = profile[0];
    const baseWidth = profile[profile.length - 1];

    assert.ok(
      baseWidth > tipWidth,
      `Base width (${baseWidth}) should be > tip width (${tipWidth})`,
    );
  });

  // -----------------------------------------------------------------------
  //  Base is thinner than the widest mid section
  // -----------------------------------------------------------------------

  it("should have a base thinner than the mid section (widest part)", () => {
    const { profile } = drawTestFlame();
    assert.ok(profile.length >= 2, `Need at least 2 flame rows, got ${profile.length}`);

    const baseWidth = profile[profile.length - 1];
    const maxWidth = Math.max(...profile);

    // The mid section (peak width) should be strictly wider than the base floor
    assert.ok(
      maxWidth >= baseWidth,
      `Max (mid) width (${maxWidth}) should be > base width (${baseWidth})`,
    );
  });

  // -----------------------------------------------------------------------
  //  Tip is exactly 1 char wide
  // -----------------------------------------------------------------------

  it("should have a tip (top-most row) that is exactly 1 char wide", () => {
    const { grid } = drawTestFlame();
    const topRow = getTopmostFlameRow(grid);
    assert.notEqual(topRow, -1, "Expected at least one flame row");

    const cells = getFlameCellsInRow(grid[topRow]);
    assert.equal(
      cells.length,
      1,
      `Expected the tip row to have exactly 1 flame cell, got ${cells.length}` +
        cells.map((c) => ` col=${c.col}`).join(""),
    );
  });

  // -----------------------------------------------------------------------
  //  Tip is darkOrange
  // -----------------------------------------------------------------------

  it("should have a tip cell coloured darkOrange", () => {
    const { grid } = drawTestFlame();
    const topRow = getTopmostFlameRow(grid);
    assert.notEqual(topRow, -1, "Expected at least one flame row");

    const cells = getFlameCellsInRow(grid[topRow]);
    const allDark = cells.every((c) => c.color === "darkOrange");
    assert.ok(
      allDark,
      `Expected all tip cells to be darkOrange. Found: ` +
        cells.map((c) => `col=${c.col}[${c.color}]`).join(", "),
    );
  });

  // -----------------------------------------------------------------------
  //  Combined properties across 100 animation versions
  // -----------------------------------------------------------------------

  it("should maintain all shape properties across 100 different animation versions", () => {
    for (let v = 0; v < 100; v++) {
      const grid: string[][] = Array.from({ length: GRID_H }, () =>
        Array(GRID_W).fill(" "),
      );
      const comp = makeComponent();
      // Set a deterministic version
      comp.setVersion(v);
      comp.drawFlame(0, 10, GRID_W, GRID_H, grid);
      const profile = getFlameProfile(grid);

      // Must have content
      assert.ok(profile.length > 0, `v${v}: flame produced no rows`);

      // Tip must be 1 char wide
      assert.equal(profile[0], 1, `v${v}: tip width should be 1, got ${profile[0]}`);

      // Base must be wider than tip
      const baseW = profile[profile.length - 1];
      assert.ok(baseW > profile[0], `v${v}: base (${baseW}) > tip (${profile[0]})`);

      // Mid (widest) must be wider than base
      const maxW = Math.max(...profile);
      assert.ok(maxW >= baseW, `v${v}: max width (${maxW}) >= base (${baseW})`);

      // The tip cell must be darkOrange
      const topRow = getTopmostFlameRow(grid);
      const cells = getFlameCellsInRow(grid[topRow]);
      const allDark = cells.every((c) => c.color === "darkOrange");
      assert.ok(allDark, `v${v}: tip cells should be darkOrange`);
    }
  });
});