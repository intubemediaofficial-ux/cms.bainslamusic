import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { kv } from "@/lib/redis";
import crypto from "crypto";


declare module "next-auth" {
  interface Session {
    error?: string;
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: "admin" | "company" | "client";
      userStatus?: "active" | "pending" | "inactive";
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    error?: string;
    role?: "admin" | "company" | "client";
    userStatus?: "active" | "pending" | "inactive";
  }
}

const ADMIN_EMAILS = [
  "ajeetgurjarofficial@gmail.com",
  "bainslamusicofficial@gmail.com",
  "shivlalbainslaofficial@gmail.com",
];

const ADMIN_CREDENTIALS: Record<string, { password?: string; name: string }> = {
  "ajeetgurjarofficial@gmail.com": {
    password: process.env.ADMIN_PASSWORD_2,
    name: "Ajeet Gurjar",
  },
  "bainslamusicofficial@gmail.com": {
    password: process.env.ADMIN_PASSWORD_3,
    name: "Bainsla Music",
  },
  "shivlalbainslaofficial@gmail.com": {
    password: process.env.ADMIN_PASSWORD_4,
    name: "Shivlal Bainsla",
  },
};

interface StoredUser {
  id: string;
  name: string;
  email: string;
  password: string;
  channels: string[];
  status: "active" | "inactive" | "pending";
  role: "client" | "company";
  parentId?: string;
}

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

async function verifyClientCredentials(
  email: string,
  password: string
): Promise<{ name: string; email: string; status: string; role: string } | null> {
  try {
    const users = await kv.get<StoredUser[]>("bainsla_users");
    if (!users) return null;

    const user = users.find(
      (u) => u.email.toLowerCase() === email && (u.status === "active" || u.status === "pending")
    );
    if (!user) return null;

    const hashed = hashPassword(password);
    if (user.password !== hashed) return null;

    return { name: user.name, email: user.email, status: user.status, role: user.role || "client" };
  } catch (error) {
    console.error("[Auth] Failed to verify client credentials:", error);
    return null;
  }
}

async function getOrCreateUserStatus(email: string, name: string): Promise<"active" | "pending" | "inactive"> {
  try {
    if (ADMIN_EMAILS.includes(email.toLowerCase())) return "active";
    const users = await kv.get<StoredUser[]>("bainsla_users") || [];
    const existing = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (existing) return existing.status;

    // Auto-register new Google login user as pending
    const newUser: StoredUser = {
      id: crypto.randomUUID(),
      name: name || email.split("@")[0],
      email: email.toLowerCase(),
      password: "",
      channels: [],
      status: "pending",
      role: "client",
    };
    users.push(newUser);
    await kv.set("bainsla_users", users);
    console.log(`[Auth] Auto-registered Google user as pending: ${email}`);
    return "pending";
  } catch (error) {
    console.error("[Auth] Failed to get/create user status:", error);
    return "pending";
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        loginType: { label: "Login Type", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email.toLowerCase();

        // Admin login
        const admin = ADMIN_CREDENTIALS[email];
        if (admin?.password && credentials.password === admin.password) {
          return {
            id: email,
            email,
            name: admin.name,
            image: null,
          };
        }

        // Client login via KV
        const client = await verifyClientCredentials(email, credentials.password);
        if (client) {
          return {
            id: client.email,
            email: client.email,
            name: client.name,
            image: null,
          };
        }

        return null;
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile",
          prompt: "select_account",
        },
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  callbacks: {
    async jwt({ token, account, user }) {
      if (account) {
        if (account.type === "credentials") {
          // Get user status from KV for credentials login
          const credEmail = (user?.email || "").toLowerCase();
          if (credEmail && !ADMIN_EMAILS.includes(credEmail)) {
            const users = await kv.get<StoredUser[]>("bainsla_users") || [];
            const storedUser = users.find((u) => u.email.toLowerCase() === credEmail);
            token.userStatus = storedUser?.status || "pending";
          }
        } else {
          // NOTE: Do NOT auto-save login tokens to channels.
          // Login scope is "openid email profile" only (no YouTube scopes).
          // Per-channel tokens with YouTube scopes are managed separately
          // via the OAuth invite link flow (/callback).
          const userEmail = (user?.email || token.email || "").toLowerCase();

          // Auto-register Google login user as pending if not exists
          if (userEmail && !ADMIN_EMAILS.includes(userEmail)) {
            const userName = user?.name || userEmail.split("@")[0];
            const status = await getOrCreateUserStatus(userEmail, userName);
            token.userStatus = status;
          }
        }
        if (user) {
          token.email = user.email;
          token.name = user.name;
        }
      }

      const email = token.email?.toLowerCase() || "";
      // Determine role: admin (hardcoded), or look up from KV (company/client)
      if (ADMIN_EMAILS.includes(email)) {
        token.role = "admin";
      } else {
        // Check KV for company role
        try {
          const users = await kv.get<StoredUser[]>("bainsla_users") || [];
          const storedUser = users.find((u) => u.email.toLowerCase() === email);
          token.role = storedUser?.role === "company" ? "company" : "client";
        } catch {
          token.role = "client";
        }
      }
      if (ADMIN_EMAILS.includes(email)) token.userStatus = "active";

      // Refresh user status from KV on each request (so admin approval takes effect)
      if (!ADMIN_EMAILS.includes(email) && email) {
        try {
          const users = await kv.get<StoredUser[]>("bainsla_users") || [];
          const storedUser = users.find((u) => u.email.toLowerCase() === email);
          if (storedUser) token.userStatus = storedUser.status;
        } catch { /* ignore */ }
      }

      return token;
    },
    async session({ session, token }) {
      session.error = token.error as string | undefined;
      if (session.user) {
        session.user.role = token.role as "admin" | "company" | "client" | undefined;
        session.user.email = (token.email as string) || session.user.email;
        session.user.name = (token.name as string) || session.user.name;
        session.user.userStatus = token.userStatus as "active" | "pending" | "inactive" | undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
