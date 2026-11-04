import LegalPage from "@/components/layout/LegalPage";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Terms of service",
  description: "The rules for using the বই catalog: what it offers, what a download allows, and what may change.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      intro="What using বই means, in plain words."
      updated="November 2026"
      sections={[
        {
          heading: "What বই is",
          body: (
            <p>
              বই is a free catalog. It lists books with their title, author,
              cover, summary and publisher, and links to where each file is
              published. Every book is the work of its author and publisher;
              the catalog does not take ownership of any of them.
            </p>
          ),
        },
        {
          heading: "What a download allows",
          body: (
            <p>
              Downloads are for your own reading. You may read them on your own
              devices and keep them. You may not resell them, upload them as
              your own, or redistribute them as a collection.
            </p>
          ),
        },
        {
          heading: "What may change",
          body: (
            <p>
              Entries are added and removed as sources change, and the layout of
              the site may change at any time. Links are provided as they are
              found; if one stops working, the entry is corrected or removed.
            </p>
          ),
        },
        {
          heading: "Questions",
          body: (
            <p>
              Email{" "}
              <a href="mailto:contact@boi.com" className="text-primary hover:underline">
                contact@boi.com
              </a>
              .
            </p>
          ),
        },
      ]}
    />
  );
}
