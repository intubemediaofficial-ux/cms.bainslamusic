import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SessionProvider from "@/components/providers/SessionProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "InTubeMedia — YouTube Channel Management System",
  description:
    "InTubeMedia — YouTube Channel Management System for content creators and music labels. Manage channels, revenue, videos and payments.",
  keywords:
    "intubemedia, youtube channel management, revenue tracking, video management, music distribution, cms",
  openGraph: {
    title: "InTubeMedia — YouTube Channel Management System",
    description:
      "InTubeMedia — YouTube Channel Management System for content creators and music labels. Manage channels, revenue, videos and payments.",
    type: "website",
  },
  icons: {
    icon: "/favicon.ico",
  },
  verification: {
    google: "EcahsfZ41sKrNAY8iZ2_eX4holWpehm71iXXMia6fgs",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
