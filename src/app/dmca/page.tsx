import LegalPage from "@/components/layout/LegalPage";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "DMCA policy",
  description: "How to report a copyright problem to বই and what happens next.",
  path: "/dmca",
});

export default function DmcaPage() {
  return (
    <LegalPage
      title="DMCA policy"
      intro="If something in the catalog infringes your copyright, here is how to tell us."
      updated="November 2026"
      sections={[
        {
          heading: "Send a notice",
          body: (
            <p>
              Email{" "}
              <a href="mailto:contact@boi.com" className="text-primary hover:underline">
                contact@boi.com
              </a>{" "}
              with the link to the material you are asking about. A notice that
              names the link is answered fastest.
            </p>
          ),
        },
        {
          heading: "What a notice needs to include",
          body: (
            <ul className="list-disc pl-6 space-y-1.5">
              <li>The link to the entry or the file you are asking about</li>
              <li>Your name, your contact details and your signature</li>
              <li>
                A statement that you believe in good faith that the material is
                infringing, and that it is being used without permission
              </li>
              <li>
                A statement that the information in the notice is accurate and
                that you are the rights holder or authorised to act for them
              </li>
            </ul>
          ),
        },
        {
          heading: "What happens next",
          body: (
            <>
              <p>
                The entry and its download link are removed while the notice is
                checked. The same happens without a second notice for the same
                work.
              </p>
              <p>
                The catalog links to files published elsewhere rather than
                hosting them, so a removed entry is removed from the catalog
                and the source is told about the notice.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
