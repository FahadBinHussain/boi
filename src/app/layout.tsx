import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Providers } from "./providers";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "বই - Free Books Download",
  description: "A digital library offering free access to books across various genres and categories.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script id="prevent-hydration-mismatch" strategy="beforeInteractive">
          {`
            (function() {
              // Ensure consistent rendering by removing any classes that might cause hydration mismatches
              if (typeof window !== 'undefined') {
                document.documentElement.className = '';
                
                // Fix for date and time hydration mismatches
                // Store the initial time at page load for components that need to use time
                window.__INITIAL_TIME__ = {
                  now: Date.now(),
                  date: new Date().toISOString()
                };
                
                // Force any floating point/random-based calculations to be deterministic during hydration
                window.__HYDRATING__ = true;
                
                // Clean up after hydration is complete
                window.addEventListener('load', function() {
                  setTimeout(function() {
                    window.__HYDRATING__ = false;
                  }, 0);
                });
              }
            })();
          `}
        </Script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
        suppressHydrationWarning
      >
        <Providers>
          <Header />
          <main className="flex-grow">
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
