/**
 * The preview image for each public route.
 *
 * Next.js serves the generated 1200x630 card at `<route>/opengraph-image`,
 * and a book page gets its own card at `/books/<id>/opengraph-image`. The
 * admin console has no card: it is not a page anyone shares.
 */
const OG_IMAGES: Record<string, string> = {
  "/": "/opengraph-image",
  "/books": "/books/opengraph-image",
  "/genres": "/genres/opengraph-image",
  "/authors": "/authors/opengraph-image",
  "/series": "/series/opengraph-image",
  "/about": "/about/opengraph-image",
  "/dataset": "/dataset/opengraph-image",
  "/auth/signin": "/opengraph-image",
  "/auth/error": "/opengraph-image",
};

export function ogImageFor(path: string) {
  if (OG_IMAGES[path]) return OG_IMAGES[path];
  if (path.startsWith("/books/")) return `${path}/opengraph-image`;
  return "/opengraph-image";
}
