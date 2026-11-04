"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImageIcon, LoaderCircle, Search, Upload } from "lucide-react";
import { previewGiftImageAction, removeGiftImageAction, uploadGiftImageAction } from "@/app/actions/gifts";
import { Button } from "@/components/ui/button";
import { dataUrlToBlob, resizeImage } from "@/lib/client-image";
import { isStoreUrl } from "@/lib/stores";

/**
 * Foto do produto no formulário de presente.
 * Ao colar o link de uma loja conhecida, buscamos a foto sozinhos. Se a loja não deixar,
 * a pessoa envia a dela. Nada é salvo até clicar em salvar o presente.
 */

type Photo =
  | { kind: "none" }
  | { kind: "saved"; src: string }
  | { kind: "new"; src: string; blob: Blob; source: "store" | "upload"; forUrl?: string };

type Lookup = "idle" | "loading" | "missing" | "blocked";

const AUTO_DELAY_MS = 700;

export function useGiftPhoto(savedUrl: string | null | undefined) {
  const [photo, setPhoto] = useState<Photo>(savedUrl ? { kind: "saved", src: savedUrl } : { kind: "none" });
  const [lookup, setLookup] = useState<Lookup>("idle");
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0); // ignora respostas de buscas antigas
  const timer = useRef<number | undefined>(undefined);
  const photoRef = useRef(photo);
  useEffect(() => {
    photoRef.current = photo;
  }, [photo]);

  // Libera a memória das pré-visualizações locais (blob:).
  useEffect(() => {
    const src = photo.kind === "new" ? photo.src : null;
    return () => {
      if (src?.startsWith("blob:")) URL.revokeObjectURL(src);
    };
  }, [photo]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const cancelLookup = useCallback(() => {
    seq.current++;
    window.clearTimeout(timer.current);
    setLookup("idle");
  }, []);

  const fetchFromStore = useCallback(async (link: string) => {
    const id = ++seq.current;
    window.clearTimeout(timer.current);
    setError(null);
    setLookup("loading");
    const r = await previewGiftImageAction(link);
    if (id !== seq.current) return;
    if (!r.ok) {
      setLookup("missing");
      setError(r.code === "RATE_LIMITED" ? r.error : null);
      return;
    }
    const result = r.data;
    if (result.found) {
      setPhoto({ kind: "new", src: result.dataUrl, blob: dataUrlToBlob(result.dataUrl), source: "store", forUrl: link });
      setLookup("idle");
    } else {
      setLookup(result.reason === "blocked" ? "blocked" : result.reason === "not_found" || result.reason === "error" ? "missing" : "idle");
    }
  }, []);

  /** Chamado a cada mudança no link do produto. */
  const onUrlChange = useCallback(
    (value: string) => {
      const link = value.trim();
      cancelLookup();
      let current = photoRef.current;
      // A foto que veio da loja só vale para o link de onde ela veio.
      if (current.kind === "new" && current.source === "store" && current.forUrl !== link) {
        current = { kind: "none" };
        setPhoto(current);
      }
      // Busca sozinha só se não houver foto escolhida pela pessoa.
      if (current.kind === "none" && isStoreUrl(link)) {
        timer.current = window.setTimeout(() => void fetchFromStore(link), AUTO_DELAY_MS);
      }
    },
    [cancelLookup, fetchFromStore],
  );

  const onFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setError(null);
      if (!file.type.startsWith("image/")) return setError("Escolha um arquivo de imagem (JPG, PNG ou WebP).");
      if (file.size > 15 * 1024 * 1024) return setError("A foto é grande demais. Use uma imagem de até 15 MB.");
      cancelLookup();
      try {
        const blob = await resizeImage(file, 960);
        setPhoto({ kind: "new", src: URL.createObjectURL(blob), blob, source: "upload" });
      } catch {
        setError("Não conseguimos abrir essa imagem. Tente outra foto.");
      }
    },
    [cancelLookup],
  );

  const remove = useCallback(() => {
    cancelLookup();
    setError(null);
    setPhoto({ kind: "none" });
  }, [cancelLookup]);

  /** Depois de salvar o presente: envia a foto nova ou apaga a antiga. Retorna o erro, se houver. */
  const persist = useCallback(
    async (giftId: string): Promise<string | null> => {
      if (photo.kind === "new") {
        const fd = new FormData();
        fd.append("photo", photo.blob, photo.blob.type === "image/webp" ? "foto.webp" : "foto.jpg");
        const r = await uploadGiftImageAction(giftId, fd);
        return r.ok ? null : r.error;
      }
      if (photo.kind === "none" && savedUrl) {
        const r = await removeGiftImageAction(giftId);
        return r.ok ? null : r.error;
      }
      return null;
    },
    [photo, savedUrl],
  );

  return { photo, lookup, error, onUrlChange, fetchFromStore, onFile, remove, persist };
}

type FieldProps = ReturnType<typeof useGiftPhoto> & { url: string; disabled?: boolean };

export function GiftPhotoField({ photo, lookup, error, fetchFromStore, onFile, remove, url, disabled }: FieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const src = photo.kind === "none" ? null : photo.src;
  const link = url.trim();
  const fromThisStore = photo.kind === "new" && photo.source === "store" && photo.forUrl === link;
  const canFetch = isStoreUrl(link) && lookup !== "loading" && !fromThisStore;

  const status =
    lookup === "loading"
      ? "Buscando a foto na loja…"
      : lookup === "blocked"
        ? "Essa loja não deixou a gente pegar a foto. Envie uma, se quiser."
        : lookup === "missing"
          ? "Não achamos a foto nessa página. Envie uma, se quiser."
          : fromThisStore
            ? "Foto tirada da loja. Troque se quiser."
            : photo.kind === "new"
              ? "Foto escolhida. Ela é salva junto com o presente."
              : photo.kind === "saved"
                ? "Foto atual do presente."
                : "Em lojas como Americanas e KaBuM a foto aparece sozinha.";

  return (
    <div>
      <p className="text-sm font-medium text-ink">
        Foto do produto <span className="font-normal text-ink-3">(opcional)</span>
      </p>
      <div className="mt-2 flex items-start gap-4">
        <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-control border border-line bg-white">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element -- pré-visualização local (data:/blob:) ou foto já salva
            <img src={src} alt="Foto do produto" width={96} height={96} className="size-full object-contain p-1" />
          ) : lookup === "loading" ? (
            <LoaderCircle className="size-6 animate-spin text-ink-3" aria-hidden />
          ) : (
            <ImageIcon className="size-6 text-ink-3" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-[14px] text-ink-2" aria-live="polite">
            {status}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={disabled} onClick={() => inputRef.current?.click()} icon={<Upload className="size-4" aria-hidden />}>
              {src ? "Trocar foto" : "Enviar foto"}
            </Button>
            {canFetch && (
              <Button size="sm" variant="outline" disabled={disabled} onClick={() => void fetchFromStore(link)} icon={<Search className="size-4" aria-hidden />}>
                Buscar na loja
              </Button>
            )}
            {src && (
              <Button size="sm" variant="ghost" disabled={disabled} onClick={remove}>
                Remover foto
              </Button>
            )}
          </div>
          {error && (
            <p aria-live="polite" className="text-sm text-berry-700">
              {error}
            </p>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        data-testid="gift-photo-input"
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
