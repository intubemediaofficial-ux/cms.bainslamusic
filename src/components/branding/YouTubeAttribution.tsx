import Image from "next/image";
import { cn } from "@/lib/utils";

interface YouTubeAttributionProps {
  className?: string;
}

export function YouTubeAttribution({ className }: YouTubeAttributionProps) {
  return (
    <a
      href="https://www.youtube.com/"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Open YouTube"
      className={cn("inline-flex items-center", className)}
    >
      <Image
        src="/branding/developed-with-youtube.png"
        alt="Developed with YouTube"
        width={700}
        height={250}
        className="h-7 w-auto"
      />
    </a>
  );
}
