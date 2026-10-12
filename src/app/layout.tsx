import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Providers } from "./providers";
import Script from "next/script";
import { Toaster } from "react-hot-toast";

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
                const darkThemes = ['dark','synthwave','halloween','forest','black','luxury','dracula','business','night','coffee','dim','sunset'];
                const storedTheme = localStorage.getItem('theme');
                const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                let theme = storedTheme;
                if (!theme || theme === 'system') {
                  theme = systemPrefersDark ? 'dark' : 'light';
                }
                document.documentElement.setAttribute('data-theme', theme);
                const isDark = darkThemes.indexOf(theme) !== -1;
                document.documentElement.classList.remove('light', 'dark');
                document.documentElement.classList.add(isDark ? 'dark' : 'light');
                
                // Fix for date and time hydration mismatches
                window.__INITIAL_TIME__ = {
                  now: Date.now(),
                  date: new Date().toISOString()
                };
                
                window.__HYDRATING__ = true;
                window.addEventListener('load', function() {
                  setTimeout(function() {
                    window.__HYDRATING__ = false;
                  }, 0);
                });
              } catch (e) {
                console.error('Error initializing theme:', e);
              }
            })();
          `}
        </Script>
      </head>
      <body
        className="font-sans antialiased min-h-screen flex flex-col bg-base-100 text-base-content"
        suppressHydrationWarning
      >
        <Providers>
          <Header />
          <main className="flex-grow bg-base-100 text-base-content">
            {children}
          </main>
          <Footer />
          <Toaster 
            position="bottom-right"
            toastOptions={{
              duration: 4000,
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
