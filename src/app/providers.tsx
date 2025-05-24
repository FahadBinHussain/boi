"use client";

import { useEffect } from 'react';
import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  // Apply the background class on the client side only
  useEffect(() => {
    // This ensures the class is only applied on the client side
    document.documentElement.classList.add('bgnone');
    
    return () => {
      document.documentElement.classList.remove('bgnone');
    };
  }, []);

  return <SessionProvider>{children}</SessionProvider>;
} 