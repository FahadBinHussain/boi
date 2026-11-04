"use client";

import { toast, type Toast } from "react-hot-toast";
import { FiX } from "react-icons/fi";
import MotionIcon from "./MotionIcon";

/**
 * An error toast that stays until it is dismissed.
 *
 * The default toast disappears after a few seconds. That is long enough for a
 * sighted user to read it and short enough that a screen reader user never
 * hears it, so an error gets a dismiss button instead of a timer.
 */
export default function ErrorToast({
  t,
  children,
}: {
  t: Toast;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-1">{children}</div>
      <button
        type="button"
        onClick={() => toast.dismiss(t.id)}
        aria-label="Dismiss notification"
        className="btn btn-ghost btn-xs btn-circle shrink-0"
      >
        <MotionIcon animation="wiggle" trigger="hover">
          <FiX className="h-3.5 w-3.5" />
        </MotionIcon>
      </button>
    </div>
  );
}

/**
 * Shows an error toast that behaves like an error.
 *
 * `role="alert"` with an assertive live region is what carries an untied
 * error to a screen reader, and `duration: Infinity` keeps it on screen until
 * the dismiss button is pressed. The defaults in `<Toaster>` are a polite
 * `role="status"` that auto-dismisses, which is right for a success message
 * and wrong for a failure.
 */
export function showErrorToast(message: React.ReactNode) {
  return toast.error((t) => <ErrorToast t={t}>{message}</ErrorToast>, {
    duration: Infinity,
    ariaProps: { role: "alert", "aria-live": "assertive" },
  });
}
