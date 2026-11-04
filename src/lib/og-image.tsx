import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

const FONT_FILE = path.join(
  process.cwd(),
  "src",
  "assets",
  "fonts",
  "HindSiliguri-Regular.ttf"
);

let fontData: Promise<ArrayBuffer> | null = null;

/**
 * Hind Siliguri is bundled with the repo because Satori draws the share card
 * from a font buffer: it cannot read the woff2 that `next/font` serves, and
 * the card is rendered while the page is being requested, not at build time.
 */
function loadFont() {
  if (!fontData) {
    fontData = readFile(FONT_FILE).then((buffer) =>
      buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      )
    );
  }
  return fontData;
}

export const OG_SIZE = { width: 1200, height: 630 };

export type OgCard = {
  /** Small label above the title. */
  kicker?: string;
  /** The headline of the card. */
  title: string;
  /** One or two lines under the headline. */
  subtitle?: string;
  /** Small line at the bottom. */
  footer?: string;
};

/**
 * Builds the 1200x630 share card for a route. The colours are the DaisyUI
 * `light` theme: `primary` #570df8 on `base-100` #ffffff with
 * `base-content` #1d232a.
 */
export async function ogImage({
  kicker = "বই",
  title,
  subtitle,
  footer = "iboi.vercel.app",
}: OgCard) {
  const font = await loadFont();

  // Satori does not shrink text to fit: a long Bengali book title at 76px
  // runs off the card. The size steps down with the length, and the text is
  // clipped so nothing spills into the footer.
  const clippedTitle = title.length > 120 ? `${title.slice(0, 119)}…` : title;
  const titleSize =
    clippedTitle.length > 90 ? 40 : clippedTitle.length > 60 ? 48 : clippedTitle.length > 34 ? 60 : 76;
  const clippedSubtitle = subtitle
    ? subtitle.length > 150
      ? `${subtitle.slice(0, 149)}…`
      : subtitle
    : undefined;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#ffffff",
          padding: "72px 80px",
          fontFamily: "Hind Siliguri",
          color: "#1d232a",
        }}
      >
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "24px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "88px",
              height: "88px",
              borderRadius: "26px",
              backgroundColor: "#570df8",
              color: "#ffffff",
              fontSize: "46px",
              fontWeight: 700,
            }}
          >
            বই
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: "30px", color: "#570df8" }}>{kicker}</div>
            <div style={{ fontSize: "26px", color: "#5b6472" }}>
              Free books to read and download
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "22px",
            maxHeight: "400px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              fontSize: `${titleSize}px`,
              lineHeight: 1.18,
              fontWeight: 700,
              overflow: "hidden",
            }}
          >
            {clippedTitle}
          </div>
          {clippedSubtitle ? (
            <div style={{ fontSize: "30px", lineHeight: 1.4, color: "#414a57" }}>
              {clippedSubtitle}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "2px solid #e5e5e5",
            paddingTop: "28px",
          }}
        >
          <div style={{ fontSize: "28px", color: "#5b6472" }}>{footer}</div>
          <div
            style={{
              display: "flex",
              width: "280px",
              height: "12px",
              borderRadius: "999px",
              backgroundColor: "#570df8",
            }}
          />
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Hind Siliguri", data: font, style: "normal", weight: 400 },
        { name: "Hind Siliguri", data: font, style: "normal", weight: 700 },
      ],
    }
  );
}
