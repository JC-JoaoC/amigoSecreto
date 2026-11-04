"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { removeAvatarAction, uploadAvatarAction } from "@/app/actions/account";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { resizeImage } from "@/lib/client-image";

/** Foto de perfil: escolher, pré-visualizar, salvar, trocar ou remover. */
export function AvatarForm({ name, seed, avatarUrl }: { name: string; seed: string; avatarUrl: string | null }) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [pending, startTransition] = useTransition();

  // Libera a memória da pré-visualização quando ela sai da tela.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Escolha um arquivo de imagem (JPG, PNG ou WebP).");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError("A foto é grande demais. Use uma imagem de até 15 MB.");
      return;
    }
    try {
      const blob = await resizeImage(file, 512, true);
      setPreview({ url: URL.createObjectURL(blob), blob });
    } catch {
      setError("Não conseguimos abrir essa imagem. Tente outra foto.");
    }
  }

  function save() {
    if (!preview) return;
    const fd = new FormData();
    fd.append("photo", preview.blob, preview.blob.type === "image/webp" ? "foto.webp" : "foto.jpg");
    startTransition(async () => {
      const r = await uploadAvatarAction(fd);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setPreview(null);
      toast.success(r.message ?? "Foto atualizada.");
    });
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element -- pré-visualização local (blob:)
        <img
          src={preview.url}
          alt="Pré-visualização da nova foto"
          width={112}
          height={112}
          className="size-28 shrink-0 rounded-full object-cover"
        />
      ) : (
        <Avatar name={name} seed={seed} src={avatarUrl} size="2xl" />
      )}

      <div className="min-w-0 space-y-2">
        {preview ? (
          <>
            <p className="text-[15px] text-ink">Ficou bom? A foto aparece para todos os participantes.</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={save} loading={pending}>
                {pending ? "Salvando…" : "Salvar foto"}
              </Button>
              <Button variant="ghost" onClick={() => setPreview(null)} disabled={pending}>
                Cancelar
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => inputRef.current?.click()}>
                {avatarUrl ? "Trocar foto" : "Escolher foto"}
              </Button>
              {avatarUrl && (
                <Button variant="danger" onClick={() => setConfirmRemove(true)}>
                  Remover foto
                </Button>
              )}
            </div>
            <p className="text-[13px] text-ink-3">JPG, PNG ou WebP. Recortamos no formato quadrado.</p>
          </>
        )}
        {error && (
          <p aria-live="polite" className="text-sm text-berry-700">
            {error}
          </p>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        data-testid="avatar-input"
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = ""; // permite escolher a mesma foto de novo
        }}
      />

      <ConfirmDialog
        open={confirmRemove}
        title="Remover sua foto?"
        description="No lugar dela voltam a aparecer as suas iniciais. Você pode colocar outra foto quando quiser."
        confirmLabel="Remover foto"
        loading={pending}
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() =>
          startTransition(async () => {
            const r = await removeAvatarAction();
            setConfirmRemove(false);
            if (r.ok) toast.success(r.message ?? "Foto removida.");
            else toast.error(r.error);
          })
        }
      />
    </div>
  );
}
