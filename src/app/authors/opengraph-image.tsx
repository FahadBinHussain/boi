import { ogImage, OG_SIZE } from "@/lib/og-image";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Every author in the বই catalog";

export default async function Image() {
  return ogImage({
    kicker: "বই · Authors",
    title: "Every author, every book",
    subtitle:
      "Open an author to see everything they wrote in the catalog, in one place.",
  });
}
