import { initials } from "@/lib/text";
import { cn } from "@/lib/cn";

// Tons sóbrios e estáveis por pessoa (derivados do id).
const palette = [
  "bg-pine-100 text-pine-800",
  "bg-berry-100 text-berry-700",
  "bg-mist-2 text-ink",
  "bg-[#efe6cc] text-[#5c4a12]",
  "bg-[#dfe7ef] text-[#1f3a52]",
  "bg-[#ece2ea] text-[#4d2a47]",
];

function colorFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

const sizes = { sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-14 text-lg", xl: "size-20 text-2xl" };

export function Avatar({ name, seed, size = "md", className }: { name: string; seed?: string; size?: keyof typeof sizes; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-grid shrink-0 select-none place-items-center rounded-full font-bold", colorFor(seed ?? name), sizes[size], className)}
    >
      {initials(name)}
    </span>
  );
}
