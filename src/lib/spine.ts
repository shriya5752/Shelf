import type { Entry } from "./types";

/** Small deterministic hash so every title always gets the same "random" look. */
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}
const rnd = (seed: string, k: number) => {
  const x = Math.sin(hash(seed) * 1e4 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export type SpineLayout = {
  width: number;
  heightPct: number;
  lean: number;
  leaner: boolean;
  marginLeft: number;
};

/** Physical look of a spine: thickness, height, tilt. Series are thicker (more seasons = thicker). */
export function spineLayout(e: Pick<Entry, "id" | "mediaType" | "seasons" | "title" | "externalId">): SpineLayout {
  const seed = `${e.externalId}:${e.title}`;
  const tv = e.mediaType === "tv";
  const width = tv ? 62 + Math.min(e.seasons ?? 1, 8) * 3 + rnd(seed, 1) * 8 : 44 + rnd(seed, 1) * 14;
  const heightPct = Math.min(98, 78 + rnd(seed, 2) * 20);
  const leaner = rnd(seed, 3) > 0.82;
  const lean = leaner ? (rnd(seed, 4) > 0.5 ? 1 : -1) * (3 + rnd(seed, 5) * 3.5) : (rnd(seed, 6) - 0.5) * 2.4;
  const marginLeft = (rnd(seed, 7) > 0.75 ? Math.round(rnd(seed, 8) * 5) : 0) + (leaner ? -3 : 0);
  return { width: Math.round(width), heightPct, lean, leaner, marginLeft };
}

const PALETTE = ["#b3262e", "#2c4a6e", "#2f5d3a", "#d96a2b", "#5c2a6e", "#c9a227", "#2c6e6a", "#e08aa6", "#3a2f55", "#6b6f5c"];

function lum(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
export const inkFor = (hex: string) => (lum(hex) > 0.6 ? "#241a14" : "#f7efe3");

export function fallbackColors(title: string): { color: string; ink: string } {
  const color = PALETTE[Math.floor(hash(title) * PALETTE.length)];
  return { color, ink: inkFor(color) };
}

/** Pull a dominant, reasonably saturated colour out of the poster so the spine matches it. */
export function extractColors(url: string | null, timeoutMs = 3500): Promise<{ color: string; ink: string } | null> {
  if (!url || typeof window === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const w = 24, h = 36;
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (!ctx) throw new Error("no ctx");
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h).data;
        let r = 0, g = 0, b = 0, wt = 0;
        for (let i = 0; i < data.length; i += 4) {
          const R = data[i], G = data[i + 1], B = data[i + 2];
          const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
          const sat = mx === 0 ? 0 : (mx - mn) / mx;
          const l = (R + G + B) / 765;
          if (l < 0.08 || l > 0.95) continue;
          const weight = 0.15 + sat * sat * 3;
          r += R * weight; g += G * weight; b += B * weight; wt += weight;
        }
        if (!wt) throw new Error("empty");
        const hex = "#" + [r, g, b].map((v) => Math.round(v / wt).toString(16).padStart(2, "0")).join("");
        clearTimeout(timer);
        resolve({ color: hex, ink: inkFor(hex) });
      } catch {
        clearTimeout(timer);
        resolve(null);
      }
    };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = url;
  });
}
