/**
 * Palette contract — the shared draw/avatar color vocabulary.
 * The draw screen now offers a doubled, double-stacked palette (16 colors).
 * The first 8 entries are load-bearing (default color at index 0; e2e keys off
 * index 1 = #E23B3B) and must never be reordered — new colors are appended.
 */
import { PALETTE } from "@/lib/palette";

const HEX = /^#[0-9A-Fa-f]{6}$/;

const ORIGINAL_EIGHT = [
  "#000000",
  "#E23B3B",
  "#FF8A3D",
  "#F5C518",
  "#2FA84F",
  "#2F6BE2",
  "#7A4A28",
  "#D9CBB8",
];

describe("PALETTE", () => {
  it("offers 16 colors (doubled from 8)", () => {
    expect(PALETTE).toHaveLength(16);
  });

  it("has no duplicate colors", () => {
    expect(new Set(PALETTE).size).toBe(PALETTE.length);
  });

  it("contains only valid #RRGGBB hex strings", () => {
    for (const color of PALETTE) {
      expect(color).toMatch(HEX);
    }
  });

  it("keeps the original 8 colors first, in order (stable indices)", () => {
    expect(PALETTE.slice(0, 8)).toEqual(ORIGINAL_EIGHT);
  });
});
