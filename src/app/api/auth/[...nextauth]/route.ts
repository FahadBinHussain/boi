import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async session({ session, user }: any) {
      // Add role to session user
      session.user.role = user.role;
      return session;
    },
    async signIn({ profile }: any) {
      // Optional: Add logic to assign admin role to specific emails
      if (profile?.email) {
        // Example: Make specific email an admin (customize as needed)
        // For first user registration, make them admin
        const userCount = await prisma.user.count();
        if (userCount === 0) {
          // First user registration, will be made admin after creation
          return true;
        }
        
        // Add any other admin assignment logic here
      }
      return true;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST }; 