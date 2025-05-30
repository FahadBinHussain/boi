"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Get error from URL if present
  const errorParam = searchParams?.get("error") || null;
  // Get callbackUrl from URL parameters or default to /admin
  const callbackUrl = searchParams?.get("callbackUrl") || "/admin";

  useEffect(() => {
    if (errorParam) {
      console.log("Authentication error detected in URL:", errorParam);
      if (errorParam === "Callback") {
        setError("Authentication failed. Please make sure your Google account is properly set up and try again.");
      } else {
        setError(`Authentication error: ${errorParam}. Please try again.`);
      }
    }
  }, [errorParam]);

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      
      // Log the auth attempt
      console.log(`Attempting Google sign-in. Callback URL: ${callbackUrl}`);
      
      // The simplest possible call to signIn with Google
      await signIn("google", { callbackUrl });
      
    } catch (error) {
      console.error("Sign-in error:", error);
      setError("Failed to start authentication. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
            Admin Console Login
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign in to access the admin dashboard
          </p>
          {error && (
            <p className="mt-2 text-center text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
              {error}
            </p>
          )}
        </div>
        <div className="mt-8 space-y-6">
          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className={`group relative flex w-full justify-center rounded-md border border-transparent ${
              isLoading ? "bg-gray-300" : "bg-white"
            } px-4 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none`}
          >
            <span className="flex items-center">
              {isLoading ? (
                <div className="mr-2 h-5 w-5 animate-spin rounded-full border-b-2 border-gray-500"></div>
              ) : (
                <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                  <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                    <path
                      fill="#4285F4"
                      d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"
                    />
                    <path
                      fill="#34A853"
                      d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"
                    />
                  </g>
                </svg>
              )}
              <span className="ml-3">
                {isLoading ? "Signing in..." : "Sign in with Google"}
              </span>
            </span>
          </button>
        </div>
        
        <div className="mt-8 text-center text-sm text-gray-500">
          <details className="my-4">
            <summary className="cursor-pointer font-medium text-indigo-600">Troubleshooting Tips</summary>
            <div className="mt-2 text-left p-4 bg-gray-50 rounded-md">
              <p className="mb-2">If you're having trouble signing in:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Make sure you're using a Google account</li>
                <li>Check that your Google account has access to this application</li>
                <li>Try clearing your browser cookies and cache</li>
                <li>Make sure you're allowing third-party cookies in your browser</li>
              </ol>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

export default function SignIn() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
              Loading...
            </h2>
          </div>
        </div>
      </div>
    }>
      <SignInContent />
    </Suspense>
  );
} 