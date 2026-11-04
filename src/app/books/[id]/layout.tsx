import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { pageMetadata } from "@/lib/seo";

/**
 * A book page is shared one at a time, so the title has to name the book. The
 * title comes from the database, not from the client component that renders
 * the page, because the crawler never runs the client bundle.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  const book = await prisma.book.findUnique({
    where: { id },
    select: { title: true, summary: true },
  });

  if (!book) {
    return pageMetadata({
      title: "Book not found",
      description: "This book is not in the বই catalog.",
      path: `/books/${id}`,
    });
  }

  const summary = book.summary?.replace(/\s+/g, " ").trim();

  return pageMetadata({
    title: book.title,
    description:
      summary && summary.length > 40
        ? summary.slice(0, 160)
        : `Read and download ${book.title} free from বই.`,
    path: `/books/${id}`,
  });
}

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return children;
}
