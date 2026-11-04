import type { Metadata } from "next";
import AdminShell from "./AdminShell";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Admin console",
  description: "Manage the বই catalog: books, users and settings.",
  path: "/admin",
  noIndex: true,
});

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
