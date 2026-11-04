import { ogImage, OG_SIZE } from "@/lib/og-image";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "The বই dataset and its exports";

export default async function Image() {
  return ogImage({
    kicker: "বই · Dataset",
    title: "The catalog behind the catalog",
    subtitle:
      "Source-backed records for every book in বই, with the status and exports open to read.",
  });
}
