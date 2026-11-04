import { ogImage, OG_SIZE } from "@/lib/og-image";
import { prisma } from "@/lib/prisma";

export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const book = await prisma.book.findUnique({
    where: { id },
    select: { title: true, summary: true },
  });

  const summary = book?.summary?.replace(/\s+/g, " ").trim();
  // The summary of a catalog entry usually repeats the title, so it is only
  // used when it actually says something the title does not.
  const subtitle =
    summary && !summary.startsWith(book?.title ?? "\u0000")
      ? summary.slice(0, 150)
      : "Read and download this book free.";

  return ogImage({
    kicker: "বই · Book",
    title: book?.title ?? "Book",
    subtitle,
  });
}
