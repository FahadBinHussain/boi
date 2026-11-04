import { ogImage, OG_SIZE } from "@/lib/og-image";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Browse every book in the বই catalog";

export default async function Image() {
  return ogImage({
    kicker: "বই · Books",
    title: "Every book in the catalog",
    subtitle:
      "Search by title, author or description and download any book in the collection.",
  });
}
