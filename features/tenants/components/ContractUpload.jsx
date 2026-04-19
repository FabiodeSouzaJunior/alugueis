"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const ACCEPT = ".pdf,.doc,.docx,.png,.jpg,.jpeg";
const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
]);

function formatFileSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType) {
  if (mimeType === "application/pdf") return "📄";
  if (mimeType === "image/png" || mimeType === "image/jpeg") return "🖼️";
  return "📝";
}

function validateFile(file) {
  if (!file) return "Nenhum arquivo selecionado.";
  if (file.size > MAX_SIZE_BYTES) return `Arquivo excede ${MAX_SIZE_MB}MB.`;
  if (!ALLOWED_TYPES.has(file.type)) return "Tipo de arquivo nao permitido. Use PDF, DOC, DOCX, PNG ou JPEG.";
  return null;
}

export function ContractUpload({
  existingContract,
  selectedFile,
  onFileSelect,
  onFileRemove,
  uploading = false,
  error: externalError,
}) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [validationError, setValidationError] = useState(null);

  const displayError = externalError || validationError;

  const handleFileChange = useCallback(
    (file) => {
      setValidationError(null);
      if (!file) return;

      const error = validateFile(file);
      if (error) {
        setValidationError(error);
        return;
      }
      onFileSelect(file);
    },
    [onFileSelect]
  );

  const handleInputChange = useCallback(
    (event) => {
      const file = event.target.files?.[0];
      handleFileChange(file);
      if (inputRef.current) inputRef.current.value = "";
    },
    [handleFileChange]
  );

  const handleDrop = useCallback(
    (event) => {
      event.preventDefault();
      setDragOver(false);
      const file = event.dataTransfer?.files?.[0];
      handleFileChange(file);
    },
    [handleFileChange]
  );

  const handleDragOver = useCallback((event) => {
    event.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleRemove = useCallback(() => {
    setValidationError(null);
    onFileRemove();
  }, [onFileRemove]);

  const hasFile = !!selectedFile || !!existingContract;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label>Contrato de locacao</Label>
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
          Opcional
        </span>
      </div>

      {hasFile ? (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
          <span className="text-xl" aria-hidden>
            {getFileIcon(selectedFile?.type || existingContract?.mimeType)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {selectedFile?.name || existingContract?.fileName || "Contrato"}
            </p>
            <p className="text-xs text-muted-foreground">
              {selectedFile
                ? formatFileSize(selectedFile.size)
                : existingContract?.sizeBytes
                  ? formatFileSize(existingContract.sizeBytes)
                  : null}
              {!selectedFile && existingContract?.uploadedAt ? (
                <span>
                  {existingContract.sizeBytes ? " · " : ""}
                  Enviado em{" "}
                  {new Date(existingContract.uploadedAt).toLocaleDateString("pt-BR")}
                </span>
              ) : null}
              {selectedFile ? " · Novo arquivo selecionado" : null}
            </p>
          </div>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              Substituir
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={uploading}
              className="text-destructive hover:text-destructive"
            >
              Remover
            </Button>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={[
            "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors",
            dragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30",
          ].join(" ")}
        >
          <span className="mb-1 text-2xl" aria-hidden>
            📎
          </span>
          <p className="text-sm font-medium">
            Arraste o contrato aqui ou clique para selecionar
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            PDF, DOC, DOCX, PNG ou JPEG — maximo {MAX_SIZE_MB}MB
          </p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={handleInputChange}
        className="hidden"
        aria-hidden
        tabIndex={-1}
      />

      {displayError ? (
        <p className="text-xs text-destructive">{displayError}</p>
      ) : null}

      {uploading ? (
        <p className="text-xs text-muted-foreground animate-pulse">Enviando contrato...</p>
      ) : null}
    </div>
  );
}
