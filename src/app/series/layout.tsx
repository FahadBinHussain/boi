import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Series",
  description: "Read a বই series in order, from the first volume to the last.",
  path: "/series",
});

export default function SeriesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
