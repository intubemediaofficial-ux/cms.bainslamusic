import Link from "next/link";
import { InTubeMediaMark } from "@/components/branding/InTubeMediaMark";
import { YouTubeAttribution } from "@/components/branding/YouTubeAttribution";

interface PublicHeaderProps {
  active?: "home" | "about" | "contact" | "faq";
}

const navigation = [
  { href: "/", label: "Home", key: "home" },
  { href: "/about", label: "About", key: "about" },
  { href: "/contact", label: "Contact", key: "contact" },
  { href: "/faq", label: "FAQ", key: "faq" },
] as const;

export function PublicHeader({ active }: PublicHeaderProps) {
  return (
    <header className="border-b border-gray-100 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <InTubeMediaMark className="w-10 h-10" textClassName="text-sm" />
          <span className="text-xl font-bold text-gray-900">InTubeMedia</span>
        </Link>
        <nav className="hidden sm:flex items-center gap-6 text-sm text-gray-600">
          {navigation.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={active === item.key ? "text-red-600 font-medium" : "hover:text-gray-900"}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/login"
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            Sign In
          </Link>
        </nav>
        <Link
          href="/login"
          className="sm:hidden bg-red-600 text-white px-3 py-2 rounded-lg text-sm"
        >
          Sign In
        </Link>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-gray-100 bg-white py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-2">
            <InTubeMediaMark className="w-8 h-8 rounded-lg" textClassName="text-[11px]" />
            <span className="font-semibold text-gray-700">InTubeMedia</span>
          </div>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-gray-500">
            <Link href="/about" className="hover:text-gray-700">About</Link>
            <Link href="/contact" className="hover:text-gray-700">Contact</Link>
            <Link href="/faq" className="hover:text-gray-700">FAQ</Link>
            <Link href="/privacy-policy" className="hover:text-gray-700">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-gray-700">Terms</Link>
          </div>
          <p className="text-sm text-gray-400">© {new Date().getFullYear()} InTubeMedia</p>
        </div>
        <div className="mt-6 flex justify-center border-t border-gray-100 pt-5">
          <YouTubeAttribution />
        </div>
      </div>
    </footer>
  );
}
