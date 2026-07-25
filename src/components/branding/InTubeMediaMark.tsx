import { cn } from "@/lib/utils";

interface InTubeMediaMarkProps {
  className?: string;
  textClassName?: string;
}

export function InTubeMediaMark({
  className,
  textClassName,
}: InTubeMediaMarkProps) {
  return (
    <div
      aria-label="InTubeMedia"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-600 to-cyan-500 shadow-lg shadow-indigo-500/20",
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn("font-black tracking-[-0.12em] text-white", textClassName)}
      >
        IM
      </span>
    </div>
  );
}
