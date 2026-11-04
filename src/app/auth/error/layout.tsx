import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Sign-in error",
  description: "The sign-in could not be completed. Try again from the sign-in page.",
  path: "/auth/error",
});

export default function AuthErrorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
