import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Extend the Session type to include the role
type ExtendedUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string;
}

export function useAdmin() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  // Cast the user to our extended type
  const user = session?.user as ExtendedUser | undefined;
  
  useEffect(() => {
    if (status === "loading") return;
    
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }
    
    if (user?.role !== "ADMIN") {
      router.push("/auth/error?error=AccessDenied");
    }
  }, [session, status, router, user]);
  
  return {
    isAdmin: user?.role === "ADMIN",
    isLoading: status === "loading",
    user,
  };
} 