import { ogImage, OG_SIZE } from "@/lib/og-image";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Browse the বই catalog by genre";

export default async function Image() {
  return ogImage({
    kicker: "বই · Genres",
    title: "Find a shelf that fits",
    subtitle:
      "Fiction, essays, textbooks, self-help and more — pick a genre and read what is inside it.",
  });
}
