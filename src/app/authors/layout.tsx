import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Authors",
  description: "Every author in the বই catalog, with every book they wrote in one place.",
  path: "/authors",
});

export default function AuthorsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
