import type { Metadata } from "next";

/**
 * Public origin of the site. Every absolute URL in the metadata — the
 * canonical link, `og:url`, `og:image` — is built from it, so a share preview
 * never points at `localhost`. Override it with `NEXT_PUBLIC_SITE_URL` when
 * the site is served from a different domain.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://iboi.vercel.app"
).replace(/\/$/, "");

/** The Bengali wordmark. Used as the site name on every share card. */
export const SITE_NAME = "বই";

export type PageSeo = {
  /** Page title, already including the site name. */
  title: string;
  /** One or two sentences describing the page. */
  description: string;
  /** Path of the page, starting with a slash. */
  path: string;
  /** Absolute or site-relative URL of the 1200x630 preview image. */
  image?: string;
  /** Keep this page out of search indexes. */
  noIndex?: boolean;
};

/**
 * Builds the metadata for one route: the title, the description, the canonical
 * URL, and the OpenGraph and Twitter card that a chat app renders when the
 * link is pasted.
 *
 * `metadataBase` in the root layout turns every relative URL here into an
 * absolute one, which is what the crawlers require.
 */
export function pageMetadata({
  title,
  description,
  path,
  image,
  noIndex = false,
}: PageSeo): Metadata {
  const url = `${SITE_URL}${path}`;
  const imageUrl = image ? `${SITE_URL}${image}` : undefined;
  // The metadata title picks up the "%s - বই" template from the root layout,
  // but OpenGraph and Twitter read the raw string, so the site name is added
  // here as well and both cards carry the same title the tab shows.
  const cardTitle = `${title} - ${SITE_NAME}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: SITE_NAME,
      title: cardTitle,
      description,
      ...(imageUrl
        ? { images: [{ url: imageUrl, width: 1200, height: 630, alt: title }] }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: cardTitle,
      description,
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
    ...(noIndex ? { robots: { index: false, follow: false } } : {}),
  };
}
