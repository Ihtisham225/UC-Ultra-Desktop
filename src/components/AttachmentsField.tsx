import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useConfirm } from "@/components/ConfirmDialog";
import { rpc, uploadAttachment } from "@/lib/apiClient";
import type { AttachmentDto, AttachmentEntity } from "@/lib/handicraftTypes";

const MAX_MB = 5;

/**
 * Upload files queued before their record exists. A new purchase or challan is
 * only given an id when it's saved, so the form holds the photos until then and
 * the parent flushes them here afterwards.
 */
export async function uploadPendingAttachments(
  entityType: AttachmentEntity,
  entityId: string,
  files: File[],
): Promise<void> {
  // Multipart can't ride the JSON rpc bridge, so photos go to their own route.
  for (const file of files) {
    await uploadAttachment(entityType, entityId, file);
  }
}

/**
 * Photos of the paper bill for one record. Handles both cases: an existing
 * record uploads straight away, a new one queues the files for the parent to
 * flush once it has an id.
 */
export function AttachmentsField({
  entityType,
  entityId,
  canEdit,
  pending,
  onPendingChange,
  compact,
}: {
  entityType: AttachmentEntity;
  /** null while the record is still being created. */
  entityId: string | null;
  canEdit: boolean;
  pending?: File[];
  onPendingChange?: (files: File[]) => void;
  compact?: boolean;
}) {
  const [items, setItems] = useState<AttachmentDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const load = useCallback(async () => {
    if (!entityId) { setItems([]); return; }
    setLoading(true);
    try {
      setItems(await rpc<AttachmentDto[]>("listAttachmentsAction", entityType, [entityId]));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load photos");
    }
    setLoading(false);
  }, [entityType, entityId]);

  useEffect(() => { load(); }, [load]);

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const chosen = Array.from(files);
    const tooBig = chosen.find((f) => f.size > MAX_MB * 1024 * 1024);
    if (tooBig) return toast.error(`“${tooBig.name}” is over ${MAX_MB} MB.`);

    if (!entityId) {
      onPendingChange?.([...(pending ?? []), ...chosen]);
      return;
    }

    setUploading(true);
    try {
      await uploadPendingAttachments(entityType, entityId, chosen);
      toast.success(chosen.length === 1 ? "Photo attached" : `${chosen.length} photos attached`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = async (a: AttachmentDto) => {
    const ok = await confirm({
      title: "Remove this photo?",
      description: "It comes off this record. The file itself is kept.",
      variant: "destructive",
    });
    if (!ok) return;
    const result = await rpc<{ ok: boolean; error?: string }>("deleteAttachmentAction", a.id);
    if (!result.ok) return toast.error(result.error ?? "Failed");
    setItems((prev) => prev.filter((x) => x.id !== a.id));
  };

  const total = items.length + (pending?.length ?? 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">
          Photos of the paper bill{total > 0 ? ` (${total})` : ""}
        </span>
        {canEdit && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
            <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
              {uploading ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Camera className="size-3.5 mr-1.5" />}
              {uploading ? "Uploading…" : "Add photo"}
            </Button>
          </>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : total === 0 ? (
        <p className="text-xs text-muted-foreground">
          {canEdit
            ? "None yet — photograph the slip and attach it here."
            : "No photos attached."}
        </p>
      ) : (
        <div className={`grid gap-2 ${compact ? "grid-cols-4 sm:grid-cols-6" : "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6"}`}>
          {items.map((a) => (
            <div key={a.id} className="relative group rounded-lg border overflow-hidden bg-muted/30">
              <a href={a.url} target="_blank" rel="noreferrer" className="block aspect-square">
                {/* Plain img: these are Vercel Blob URLs, already sized by the phone. */}
                <img src={a.url} alt={a.file_name ?? "Bill photo"} className="size-full object-cover" />
              </a>
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                <a href={a.url} target="_blank" rel="noreferrer" className="p-1.5" title="Open full size">
                  <ExternalLink className="size-3.5" />
                </a>
                {canEdit && (
                  <button type="button" className="p-1.5" title="Remove" onClick={() => remove(a)}>
                    <Trash2 className="size-3.5 text-destructive" />
                  </button>
                )}
              </div>
            </div>
          ))}

          {(pending ?? []).map((f, i) => (
            <div key={`pending-${i}`} className="relative rounded-lg border border-dashed overflow-hidden bg-muted/30 aspect-square flex flex-col items-center justify-center p-1 text-center">
              <Camera className="size-4 text-muted-foreground mb-1" />
              <span className="text-[10px] text-muted-foreground line-clamp-2 break-all">{f.name}</span>
              <span className="text-[9px] text-muted-foreground/70">attaches on save</span>
              {canEdit && (
                <button
                  type="button"
                  className="absolute top-0.5 end-0.5 p-1"
                  title="Remove"
                  onClick={() => onPendingChange?.((pending ?? []).filter((_, x) => x !== i))}
                >
                  <Trash2 className="size-3 text-destructive" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {confirmDialog}
    </div>
  );
}

/** The same field in its own dialog, opened from a paperclip on a list row. */
export function AttachmentsDialog({
  open,
  onClose,
  title,
  entityType,
  entityId,
  canEdit,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  entityType: AttachmentEntity;
  entityId: string | null;
  canEdit: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <AttachmentsField entityType={entityType} entityId={entityId} canEdit={canEdit} />
      </DialogContent>
    </Dialog>
  );
}
