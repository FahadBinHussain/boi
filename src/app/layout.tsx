import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import RouteAnnouncer from "@/components/layout/RouteAnnouncer";
import { Providers } from "./providers";
import Script from "next/script";
import { Toaster } from "react-hot-toast";
import { Inter, Hind_Siliguri } from "next/font/google";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

// Latin UI face. Exposed as --font-inter, which tailwind.config.ts maps into
// fontFamily.sans. Inter has no Bengali glyphs, so Bengali text falls through
// to --font-bengali below.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Bengali face for the catalog content (titles, authors, summaries).
const bengali = Hind_Siliguri({
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-bengali",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "বই - Free Books Download",
    template: "%s - বই",
  },
  description: "A digital library offering free access to books across various genres.",
  alternates: { canonical: `${SITE_URL}/` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/`,
    siteName: SITE_NAME,
    title: "বই - Free Books Download",
    description: "A digital library offering free access to books across various genres.",
    images: [
      {
        url: `${SITE_URL}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "বই — free books to read and download",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "বই - Free Books Download",
    description: "A digital library offering free access to books across various genres.",
    images: [`${SITE_URL}/opengraph-image`],
  },
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
        className={`${inter.variable} ${bengali.variable} font-sans antialiased min-h-dvh flex flex-col bg-base-100 text-base-content`}
        suppressHydrationWarning
      >
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <Providers>
          <RouteAnnouncer />
          <Header />
          <main
            id="main-content"
            tabIndex={-1}
            className="flex-grow bg-base-100 text-base-content"
          >
            {children}
          </main>
          <Footer />
          <Toaster
            position="bottom-right"
            toastOptions={{
              duration: 4000,
              // An error has to be read, not glimpsed: error toasts stay until
              // they are dismissed. `showErrorToast` adds the dismiss button
              // and the assertive announcement on top of this.
              error: { duration: Infinity },
              success: {
                ariaProps: { role: "status", "aria-live": "polite" },
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
