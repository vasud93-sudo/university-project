import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

const DEMO_MODE = process.env.DEMO_MODE === "true";
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const providers = [];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Lock down to the school's Google Workspace domain in production, e.g.:
      // authorization: { params: { hd: "fountainheadschools.org" } },
    })
  );
}

// Dev/demo login: pick any seeded user by email, no password, no Google
// project required. Only wired up when DEMO_MODE=true - keep this off in
// any real deployment.
if (DEMO_MODE) {
  providers.push(
    Credentials({
      id: "demo",
      name: "Demo login",
      credentials: {
        email: { label: "School email", type: "email" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        if (!email) return null;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;
        return { id: user.id, email: user.email, name: user.name ?? user.email };
      },
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const email = user.email.toLowerCase();

      const existing = await prisma.user.findUnique({ where: { email } });
      // Admin roster uploads create the User row (with grade/section) ahead
      // of time, keyed by email - so if this email is already in the roster,
      // there's nothing left to do but let the sign-in proceed.
      if (existing) return true;

      // Otherwise this is a brand-new email with no roster entry: create a
      // bare account, promoting to ADMIN if it's on the allowlist.
      await prisma.user.create({
        data: {
          email,
          name: user.name ?? email,
          role: ADMIN_EMAILS.includes(email) ? "ADMIN" : "STUDENT",
        },
      });
      return true;
    },
    async jwt({ token }) {
      if (token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email.toLowerCase() },
        });
        if (dbUser) {
          token.uid = dbUser.id;
          token.role = dbUser.role;
          token.grade = dbUser.grade ?? undefined;
          token.section = dbUser.section ?? undefined;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.role = token.role as "STUDENT" | "ADMIN";
        session.user.grade = (token.grade as number | undefined) ?? null;
        session.user.section = (token.section as string | undefined) ?? null;
      }
      return session;
    },
  },
});
