import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import { checkEnvironmentVariables } from "@/lib/check-env";

// Check environment variables first
checkEnvironmentVariables();

// Log key authentication configuration values for debugging
console.log("🔐 NextAuth Configuration:");
console.log(`- NEXTAUTH_URL: ${process.env.NEXTAUTH_URL}`);
console.log(`- Google OAuth Callback URL: ${process.env.NEXTAUTH_URL}/api/auth/callback/google`);
console.log(`- GOOGLE_CLIENT_ID exists: ${Boolean(process.env.GOOGLE_CLIENT_ID)}`);
console.log(`- GOOGLE_CLIENT_SECRET exists: ${Boolean(process.env.GOOGLE_CLIENT_SECRET)}`);
console.log(`- NEXTAUTH_SECRET exists: ${Boolean(process.env.NEXTAUTH_SECRET)}`);

export const authOptions = {
  adapter: PrismaAdapter(prisma as any), // Type assertion to avoid compatibility issues
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      // Simplify the authorization parameters - remove any that might cause issues
      authorization: {
        params: {
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async session({ session, user }: any) {
      // Add role and ID to session user
      console.log("Session callback with user:", { userId: user.id, email: user.email, role: user.role });
      if (session?.user) {
        session.user.id = user.id;
        session.user.role = user.role;
      }
      return session;
    },
    async signIn({ profile, account, user }: any) {
      console.log("SignIn callback triggered", { 
        email: profile?.email,
        id: user?.id,
        userEmail: user?.email,
        accountType: account?.provider
      });
      if (user?.email) {
        try {
          const updated = await prisma.user.update({
            where: { email: user.email },
            data: { lastLogin: new Date() }
          });
          console.log('lastLogin updated for user:', updated.email, updated.lastLogin);
        } catch (e) {
          console.error('Failed to update lastLogin:', e);
        }
      } else {
        console.warn('No user.email found in signIn callback');
      }
      // Always allow sign-in (avoid any logic that might reject valid users)
      return true;
    },
    // Simplify redirect callback to ensure it works correctly
    async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
      console.log(`Redirect callback called: url=${url}, baseUrl=${baseUrl}`);
      
      // Always allow relative URLs
      if (url.startsWith("/")) {
        const fullUrl = `${baseUrl}${url}`;
        console.log(`Redirecting to: ${fullUrl}`);
        return fullUrl;
      }
      
      // Allow same-origin URLs
      try {
        const urlObj = new URL(url);
        const baseUrlObj = new URL(baseUrl);
        
        if (urlObj.origin === baseUrlObj.origin) {
          console.log(`Redirecting to same origin: ${url}`);
          return url;
        }
      } catch (error) {
        console.error("Error parsing URL:", error);
      }
      
      // Default fallback
      console.log(`Redirecting to baseUrl: ${baseUrl}`);
      return baseUrl;
    },
  },
  debug: true, // Keep debugging enabled
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  events: {
    async signIn(message: any) { 
      console.log("✅ User signed in:", { 
        user: message.user?.email,
        provider: message.account?.provider 
      }); 
      
      // Create settings for existing users if they don't have them yet
      if (message.user?.id) {
        try {
          // Check if settings exist
          const existingSettings = await prisma.userSettings.findUnique({
            where: { userId: message.user.id },
            select: { userId: true }
          });
          
          // If no settings exist, create them
          if (!existingSettings) {
            await prisma.userSettings.create({
              data: {
                userId: message.user.id,
                // Only use fields that exist in the schema
              }
            });
            console.log(`⚙️ Default settings created for existing user ${message.user.email} during sign-in`);
          }
        } catch (error) {
          console.error("❌ Failed to check/create settings on sign-in:", error);
        }
      }
    },
    async createUser(message: any) {
      console.log("👤 New user created:", { 
        email: message.user?.email,
        id: message.user?.id 
      });
      
      // If this is the first user, make them an admin
      if (message.user?.id) {
        try {
          const userCount = await prisma.user.count();
          if (userCount === 1) { // The count includes the user we just created
            await prisma.user.update({
              where: { id: message.user.id },
              data: { role: "ADMIN" },
            });
            console.log(`🔑 User ${message.user.email} set as admin (first user)`);
          }
          
          // Create default user settings for new user
          await prisma.userSettings.create({
            data: {
              userId: message.user.id,
              // Only use fields that exist in the schema
            }
          });
          console.log(`⚙️ Default settings created for new user ${message.user.email}`);
        } catch (error) {
          console.error("❌ Failed to update user role or create settings:", error);
        }
      }
    },
    async error(error: any) {
      console.error("❌ Authentication error:", error);
    }
  },
  secret: process.env.NEXTAUTH_SECRET,
  // Disable CSRF protection for local development (often helps with callback issues)
  useSecureCookies: process.env.NODE_ENV === "production",
}; 