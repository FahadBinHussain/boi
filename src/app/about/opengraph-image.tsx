import { ogImage, OG_SIZE } from "@/lib/og-image";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "About বই";

export default async function Image() {
  return ogImage({
    kicker: "বই · About",
    title: "A library that stays open",
    subtitle:
      "What বই is, who builds it, and how to get in touch.",
  });
}
