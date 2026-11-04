import { ogImage, OG_SIZE } from "@/lib/og-image";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "বই — free books to read and download";

export default async function Image() {
  return ogImage({
    title: "Free books, ready to read",
    subtitle:
      "A Bengali catalog of free books: fiction, essays, textbooks and self-help, every one with a direct download.",
  });
}
