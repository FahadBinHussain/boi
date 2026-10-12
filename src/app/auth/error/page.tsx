"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import MotionIcon from "@/components/ui/MotionIcon";
import { FiAlertCircle, FiArrowLeft, FiLoader } from "react-icons/fi";

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams?.get("error") || "";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-base-100 text-base-content py-12 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="w-full max-w-md card bg-base-200 border border-base-content/10 shadow-2xl p-8 rounded-3xl space-y-6 text-center">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-error/10 text-error flex items-center justify-center">
            <MotionIcon animation="wiggle" trigger="always">
              <FiAlertCircle size={28} />
            </MotionIcon>
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-extrabold text-base-content">
            Authentication Error
          </h2>
          <p className="mt-2 text-sm text-base-content/70">
            {error === "AccessDenied"
              ? "You do not have permission to access this resource."
              : "There was an error signing you in. Please try again."}
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/auth/signin"
            className="btn btn-primary btn-block gap-2"
          >
            <MotionIcon animation="bounce">
              <FiArrowLeft size={16} />
            </MotionIcon>
            Return to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ErrorPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen flex-col items-center justify-center bg-base-100 text-base-content py-12 px-4">
        <div className="w-full max-w-md card bg-base-200 border border-base-content/10 shadow-2xl p-8 rounded-3xl text-center">
          <MotionIcon animation="spin" trigger="always">
            <FiLoader className="h-8 w-8 text-primary mx-auto mb-2" />
          </MotionIcon>
          <h2 className="text-xl font-bold text-base-content">
            Loading...
          </h2>
        </div>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  );
}