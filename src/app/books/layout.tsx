import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Books",
  description: "Browse the full বই catalog: every free book, with cover, summary, publisher and a direct download.",
  path: "/books",
});

export default function BooksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
