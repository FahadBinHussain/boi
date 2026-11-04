import { ogImage, OG_SIZE } from "@/lib/og-image";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Read a বই series in order";

export default async function Image() {
  return ogImage({
    kicker: "বই · Series",
    title: "Read the whole series",
    subtitle:
      "Every volume of a series, from the first book to the last, ready to download.",
  });
}
