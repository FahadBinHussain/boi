import LegalPage from "@/components/layout/LegalPage";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Copyright notice",
  description: "Who owns the books in the বই catalog and what the catalog itself stores.",
  path: "/copyright",
});

export default function CopyrightPage() {
  return (
    <LegalPage
      title="Copyright notice"
      intro="The books belong to their authors. The catalog only describes them."
      updated="November 2026"
      sections={[
        {
          heading: "The work belongs to its author",
          body: (
            <p>
              Every book in the catalog belongs to its author, its translator or
              its publisher. বই does not claim any ownership of the works it
              lists, and no entry implies that a book is free to copy.
            </p>
          ),
        },
        {
          heading: "What the catalog stores",
          body: (
            <>
              <p>
                An entry holds the bibliographic details needed to identify a
                book: its title, its authors, its publisher, its publication
                date, its genres and a short summary, plus a cover image that
                is loaded from the source page rather than copied.
              </p>
              <p>
                The files themselves are not hosted here. A download link points
                at the archive the book was published on.
              </p>
            </>
          ),
        },
        {
          heading: "Removing an entry",
          body: (
            <p>
              If you are a rights holder and you want an entry removed, email{" "}
              <a href="mailto:contact@boi.com" className="text-primary hover:underline">
                contact@boi.com
              </a>{" "}
              with the link to the entry. It is taken down.
            </p>
          ),
        },
      ]}
    />
  );
}
