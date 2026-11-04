import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Genres",
  description: "Pick a genre and read what বই has inside it: fiction, essays, textbooks, self-help and more.",
  path: "/genres",
});

export default function GenresLayout({ children }: { children: React.ReactNode }) {
  return children;
}
