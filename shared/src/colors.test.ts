import { describe, expect, it } from "vitest";
import { ROOM_COLORS, canonicalRoomColor, offerRoomColors } from "./colors";

function hueGap(a: number, b: number): number {
  const delta = Math.abs(a - b) % 360;
  return Math.min(delta, 360 - delta);
}

function hueOf(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const red = ((n >> 16) & 255) / 255;
  const green = ((n >> 8) & 255) / 255;
  const blue = (n & 255) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  if (max === min) return 0;
  const delta = max - min;
  const hue =
    max === red
      ? (green - blue) / delta + (green < blue ? 6 : 0)
      : max === green
        ? (blue - red) / delta + 2
        : (red - green) / delta + 4;
  return hue * 60;
}

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

describe("offerRoomColors", () => {
  const used = [ROOM_COLORS[0].hex, ROOM_COLORS[1].hex, ROOM_COLORS[3].hex, ROOM_COLORS[5].hex];

  it("offers a rainbow that stays clear of colors already on a room", () => {
    const offered = offerRoomColors(used, 6, rng(4));
    const hues = offered.map(hueOf);
    expect(offered).toHaveLength(6);
    expect(new Set(offered).size).toBe(6);
    for (const hex of offered) {
      expect(canonicalRoomColor(hex)).toBe(hex);
      expect(used.map((color) => color.toLowerCase())).not.toContain(hex.toLowerCase());
    }
    const usedHues = used.map(hueOf);
    for (const hue of hues) {
      expect(Math.min(...usedHues.map((other) => hueGap(hue, other)))).toBeGreaterThanOrEqual(16);
    }
    for (let index = 0; index < hues.length; index += 1) {
      for (let next = index + 1; next < hues.length; next += 1) {
        expect(hueGap(hues[index], hues[next])).toBeGreaterThanOrEqual(36);
      }
    }
  });

  it("rejects a fill that is too dark to read", () => {
    expect(canonicalRoomColor("#000000")).toBeNull();
    expect(canonicalRoomColor("#8C3A2F")).toBeNull();
  });
});
