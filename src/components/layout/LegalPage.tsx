import Link from "next/link";
import { FiBook } from "react-icons/fi";
import MotionIcon from "@/components/ui/MotionIcon";

export type LegalSection = {
  heading: string;
  body: React.ReactNode;
};

/**
 * Shared shell for the legal pages. Four pages with the same heading, card
 * and footer would otherwise drift apart in spacing and wording.
 */
export default function LegalPage({
  title,
  intro,
  updated,
  sections,
}: {
  title: string;
  intro: string;
  updated: string;
  sections: LegalSection[];
}) {
  return (
    <div className="bg-base-100 text-base-content min-h-screen py-12 transition-colors">
      <div className="shell">
        <div className="mx-auto max-w-3xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl text-primary mb-4 shadow-sm">
              <MotionIcon animation="float">
                <FiBook size={28} />
              </MotionIcon>
            </div>
            <h1 className="text-4xl font-extrabold text-base-content mb-3">{title}</h1>
            <p className="text-base text-base-content/75 max-w-2xl mx-auto">{intro}</p>
          </div>

          <div className="card bg-base-200/60 border border-base-content/10 rounded-3xl shadow-xl overflow-hidden mb-12">
            <div className="card-body p-8 md:p-12">
              {sections.map((section) => (
                <section key={section.heading} className="mb-8 last:mb-0">
                  <h2 className="text-2xl font-bold text-base-content mb-3">
                    {section.heading}
                  </h2>
                  <div className="text-base-content/80 leading-relaxed space-y-3 text-base">
                    {section.body}
                  </div>
                </section>
              ))}
            </div>
          </div>

          <div className="text-center">
            <p className="text-sm text-base-content/75 mb-4">Last updated: {updated}</p>
            <Link href="/about" className="btn btn-outline btn-sm gap-2">
              Back to About <span lang="bn">বই</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
