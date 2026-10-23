import { ImageResponse } from "next/og";

export const alt = "Shelf: your watchlist, as a library";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const spines = ["#c97b72", "#8fae98", "#e3b9a8", "#6f8f86", "#d99a8f", "#b4c7b2", "#a85e58", "#cfa38d"];

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 80, background: "linear-gradient(160deg,#fbf3f1,#e9f0e8)", color: "#3a2a2a" }}>
        <div style={{ display: "flex", fontSize: 44, letterSpacing: 2 }}>shelf<span style={{ color: "#b85c52" }}>.</span></div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 92, lineHeight: 1.05, fontStyle: "italic" }}>Every film you love,</div>
          <div style={{ display: "flex", fontSize: 92, lineHeight: 1.05, fontStyle: "italic" }}>on one shelf.</div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
          {spines.concat(spines).map((c, i) => (
            <div key={i} style={{ width: 42, height: 150 + ((i * 37) % 70), background: c, borderRadius: 4, transform: `rotate(${(i % 3) - 1}deg)` }} />
          ))}
        </div>
      </div>
    ),
    size,
  );
}
