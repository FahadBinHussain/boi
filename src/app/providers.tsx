"use client";

import { SessionProvider } from "next-auth/react";
import { BackgroundProvider } from "@/contexts/BackgroundContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <BackgroundProvider>
        {children}
      </BackgroundProvider>
    </SessionProvider>
  );
} 