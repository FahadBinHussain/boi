'use client';

// This is a client component wrapper to ensure consistent HTML class attributes
// between server and client rendering to fix hydration errors
export default function ClientHtmlWrapper({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bgnone">
      {children}
    </html>
  );
} 