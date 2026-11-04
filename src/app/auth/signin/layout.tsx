import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Sign in",
  description: "Sign in to বই to add books, upload PDFs and manage the catalog.",
  path: "/auth/signin",
});

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return children;
}
