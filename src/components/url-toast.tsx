"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { useToast } from "@/components/ui/toast";

/** Mostra um aviso quando a URL tem ?param (ex.: ?saiu=1) e limpa o parâmetro. */
export function UrlToast({ param, message }: { param: string; message: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current || !params.has(param)) return;
    shown.current = true;
    toast.success(message);
    const next = new URLSearchParams(params.toString());
    next.delete(param);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  }, [params, param, message, pathname, router, toast]);

  return null;
}
