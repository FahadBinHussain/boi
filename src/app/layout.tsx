import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Providers } from "./providers";
import Script from "next/script";
import { Toaster } from "react-hot-toast";

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
          <Toaster 
            position="bottom-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#333',
                color: '#fff',
                boxShadow: '0 3px 10px rgba(0,0,0,0.2)',
                padding: '16px',
                borderRadius: '8px',
              },
              success: {
                style: {
                  background: '#10B981',
                },
              },
              error: {
                style: {
                  background: '#EF4444',
                },
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
