import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Providers } from "./providers";
import Script from "next/script";
import { Toaster } from "react-hot-toast";

// Load Inter font from Google Fonts instead of Fontsource
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

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
  description: "A digital library offering free access to books across various genres.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script id="theme-script" strategy="beforeInteractive">
          {`
            (function() {
              try {
                // Check for stored theme preference
                const storedTheme = localStorage.getItem('theme');
                const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                
                // Determine which theme to use
                let theme;
                if (storedTheme === 'dark' || storedTheme === 'light') {
                  theme = storedTheme;
                } else if (storedTheme === 'system') {
                  theme = systemPrefersDark ? 'dark' : 'light';
                } else {
                  theme = systemPrefersDark ? 'dark' : 'light';
                }
                
                // Apply theme class immediately to avoid flash
                document.documentElement.classList.remove('light', 'dark');
                document.documentElement.classList.add(theme);
                
                // Fix for date and time hydration mismatches
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
              } catch (e) {
                // Fallback if localStorage is not available
                console.error('Error accessing localStorage:', e);
              }
            })();
          `}
        </Script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} font-sans antialiased min-h-screen flex flex-col`}
        suppressHydrationWarning
      >
        <Providers>
          <Header />
          <main className="flex-grow bg-background text-foreground">
            {children}
          </main>
          <Footer />
          <Toaster 
            position="bottom-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: 'var(--card-bg)',
                color: 'var(--foreground)',
                boxShadow: '0 3px 10px rgba(0,0,0,0.2)',
                padding: '16px',
                borderRadius: '8px',
              },
              success: {
                style: {
                  background: 'var(--accent-secondary)',
                  color: 'white',
                },
              },
              error: {
                style: {
                  background: '#EF4444',
                  color: 'white',
                },
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
