import Link from "next/link";
import { FiBook, FiCompass, FiDatabase } from "react-icons/fi";
import MotionIcon from "@/components/ui/MotionIcon";

/**
 * The page Next.js renders for any URL that does not match a route. Without
 * it the site answers a bare framework page with no way back into the
 * catalog.
 */
export default function NotFound() {
  return (
    <div className="bg-base-100 text-base-content min-h-screen py-16 transition-colors">
      <div className="shell">
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl text-primary mb-6 shadow-sm">
            <MotionIcon animation="float">
              <FiBook size={28} />
            </MotionIcon>
          </div>

          <p className="text-sm font-bold tracking-[0.25em] uppercase text-primary mb-3">
            404
          </p>
          <h1 className="text-4xl font-extrabold text-base-content mb-4">
            That page is not in the catalog
          </h1>
          <p className="text-base text-base-content/75 mb-10 max-w-xl mx-auto leading-relaxed">
            The link may be mistyped, or the entry may have been removed.
            Search the catalog instead, or start from one of these.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/books" className="btn btn-primary gap-2">
              <MotionIcon animation="bounce" trigger="hover">
                <FiCompass className="h-4 w-4" />
              </MotionIcon>
              Browse books
            </Link>
            <Link href="/dataset" className="btn btn-outline gap-2">
              <MotionIcon animation="wiggle" trigger="hover">
                <FiDatabase className="h-4 w-4" />
              </MotionIcon>
              Dataset
            </Link>
            <Link href="/" className="btn btn-ghost">
              Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
