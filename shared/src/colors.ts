/** Sunset fills. Type on them stays ink, so every one of these stays readable. */
export const ROOM_COLORS = [
  { name: "Sun", hex: "#F0C84A" },
  { name: "Ember", hex: "#F08A3C" },
  { name: "Coral", hex: "#F07A62" },
  { name: "Rose", hex: "#E86B8A" },
  { name: "Bloom", hex: "#E070B0" },
  { name: "Dusk", hex: "#C9A0E0" },
] as const;

export type RoomColor = (typeof ROOM_COLORS)[number]["hex"];

const INK = [31, 26, 20] as const;

export function canonicalRoomColor(value: string): string | null {
  const named = ROOM_COLORS.find((color) => color.hex.toLowerCase() === value.trim().toLowerCase());
  if (named) return named.hex;
  const hex = normalizeHex(value);
  if (!hex || !isPaletteFill(hex)) return null;
  return hex;
}

const RAINBOW = [6, 100, 158, 198, 248, 328];

/** Six light fills around the rainbow, nudged off any hue a room already uses. */
export function offerRoomColors(used: readonly string[], count = 6, rng: () => number = Math.random): string[] {
  const usedHues = used
    .map((value) => parseHex(value))
    .filter((rgb): rgb is Rgb => rgb != null)
    .map((rgb) => rgbToHsl(rgb)[0]);
  const offered: string[] = [];
  const chosen: number[] = [];
  const targets = RAINBOW.slice(0, count);
  for (const target of targets) {
    const hue = slideHue(target, [...usedHues, ...chosen], 18);
    const hex = readableFill(hue, rng);
    if (!hex) continue;
    offered.push(hex);
    chosen.push(rgbToHsl(parseHex(hex) as Rgb)[0]);
  }
  return offered;
}

export function roomColorLabel(hex: string): string {
  const named = ROOM_COLORS.find((color) => color.hex.toLowerCase() === hex.toLowerCase());
  if (named) return named.name;
  const rgb = parseHex(hex);
  if (!rgb) return "Color";
  const [hue] = rgbToHsl(rgb);
  if (hue < 18 || hue >= 345) return "Red";
  if (hue < 42) return "Orange";
  if (hue < 70) return "Yellow";
  if (hue < 105) return "Lime";
  if (hue < 155) return "Green";
  if (hue < 185) return "Teal";
  if (hue < 215) return "Cyan";
  if (hue < 255) return "Blue";
  if (hue < 285) return "Indigo";
  if (hue < 320) return "Violet";
  return "Pink";
}

type Rgb = [number, number, number];

function normalizeHex(value: string): string | null {
  const match = /^#([0-9a-f]{6})$/i.exec(value.trim());
  return match ? `#${match[1].toUpperCase()}` : null;
}

function parseHex(value: string): Rgb | null {
  const hex = normalizeHex(value);
  if (!hex) return null;
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function isPaletteFill(hex: string): boolean {
  const rgb = parseHex(hex);
  if (!rgb) return false;
  const [, saturation, lightness] = rgbToHsl(rgb);
  if (saturation < 42 || saturation > 88 || lightness < 66 || lightness > 82) return false;
  return contrast(rgb, INK) >= 4.5;
}

function slideHue(target: number, blocked: number[], gap: number): number {
  const clear = (hue: number) => blocked.every((other) => hueDistance(hue, other) >= gap);
  const wrapped = (hue: number) => ((hue % 360) + 360) % 360;
  if (clear(wrapped(target))) return wrapped(target);
  for (let step = 4; step <= 120; step += 4) {
    if (clear(wrapped(target + step))) return wrapped(target + step);
    if (clear(wrapped(target - step))) return wrapped(target - step);
  }
  return wrapped(target);
}

function readableFill(hue: number, rng: () => number): string | null {
  const saturation = 76 + rng() * 6;
  for (const lightness of [71, 73, 75]) {
    const hex = hslToHex(((hue % 360) + 360) % 360, saturation, lightness);
    if (canonicalRoomColor(hex) === hex) return hex;
  }
  return null;
}

function hueDistance(a: number, b: number): number {
  const delta = Math.abs(a - b) % 360;
  return Math.min(delta, 360 - delta);
}

function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  if (max === min) return [0, 0, lightness * 100];
  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  const hue =
    max === red
      ? (green - blue) / delta + (green < blue ? 6 : 0)
      : max === green
        ? (blue - red) / delta + 2
        : (red - green) / delta + 4;
  return [hue * 60, saturation * 100, lightness * 100];
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const sat = saturation / 100;
  const lig = lightness / 100;
  const chroma = (1 - Math.abs(2 * lig - 1)) * sat;
  const hp = (((hue % 360) + 360) % 360) / 60;
  const x = chroma * (1 - Math.abs((hp % 2) - 1));
  const [r, g, b] =
    hp < 1 ? [chroma, x, 0] : hp < 2 ? [x, chroma, 0] : hp < 3 ? [0, chroma, x] : hp < 4 ? [0, x, chroma] : hp < 5 ? [x, 0, chroma] : [chroma, 0, x];
  const match = lig - chroma / 2;
  const channel = (value: number) => Math.round((value + match) * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`.toUpperCase();
}

function contrast(fill: Rgb, ink: readonly [number, number, number]): number {
  const lighter = Math.max(luminance(fill), luminance(ink));
  const darker = Math.min(luminance(fill), luminance(ink));
  return (lighter + 0.05) / (darker + 0.05);
}

function luminance([r, g, b]: Rgb | readonly [number, number, number]): number {
  const channel = (value: number) => {
    const s = value / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
