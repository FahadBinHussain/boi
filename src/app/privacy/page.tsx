import LegalPage from "@/components/layout/LegalPage";
import { pageMetadata } from "@/lib/seo";
import { CONTACT_URL } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Privacy policy",
  description: "What বই stores, what it does not store, and how to have your data removed.",
  path: "/privacy",
});

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      intro="বই keeps the personal data it needs to run the catalog, and nothing else."
      updated="November 2026"
      sections={[
        {
          heading: "What is stored",
          body: (
            <>
              <p>
                Reading the catalog needs no account. If you sign in with Google,
                the site stores your name, your email address and your profile
                picture, your role, and the time of your last sign-in.
              </p>
              <p>
                If you are a contributor and save settings in the admin console,
                the storage API key and account ID you type are stored so the
                uploader can use them. They are shown only inside the console.
              </p>
            </>
          ),
        },
        {
          heading: "What is not stored",
          body: (
            <p>
              There is no analytics script, no advertising network and no
              third-party tracking cookie on this site. Nothing about what you
              read is recorded, because nothing about what you read is sent to
              us in the first place.
            </p>
          ),
        },
        {
          heading: "Removing your data",
          body: (
            <p>
              Open an issue on the{" "}
              <a
                href={CONTACT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                project&apos;s issue tracker
              </a>{" "}
              with the address you signed in with, and the account and its
              stored settings are deleted.
            </p>
          ),
        },
      ]}
    />
  );
}
