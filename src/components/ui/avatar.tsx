import { initials } from "@/lib/text";
import { cn } from "@/lib/cn";

// Tons sóbrios e estáveis por pessoa (derivados do id), usados quando não há foto.
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

const sizes = {
  sm: { cls: "size-8 text-xs", px: 32 },
  md: { cls: "size-10 text-sm", px: 40 },
  lg: { cls: "size-14 text-lg", px: 56 },
  xl: { cls: "size-20 text-2xl", px: 80 },
  "2xl": { cls: "size-28 text-4xl", px: 112 },
};

/** Foto de perfil quando existe; senão, as iniciais em uma cor estável. Decorativo: o nome vem ao lado. */
export function Avatar({
  name,
  seed,
  src,
  size = "md",
  className,
}: {
  name: string;
  seed?: string;
  src?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const s = sizes[size];
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- imagem já otimizada no servidor (256px WebP)
      <img
        src={src}
        alt=""
        aria-hidden
        width={s.px}
        height={s.px}
        loading="lazy"
        decoding="async"
        className={cn("shrink-0 rounded-full bg-mist-2 object-cover", s.cls, className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn("inline-grid shrink-0 select-none place-items-center rounded-full font-bold", colorFor(seed ?? name), s.cls, className)}
    >
      {initials(name)}
    </span>
  );
}
