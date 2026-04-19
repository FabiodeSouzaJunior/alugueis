"use client";

import { useCallback, useEffect, useState } from "react";
import {
  uploadTenantContract,
  deleteTenantContract,
  fetchTenantContract,
} from "../services/tenants.service";

export function useTenantContract(tenantId, tenant) {
  const [existingContract, setExistingContract] = useState(() => {
    if (tenant?.contractFilePath) {
      return {
        filePath: tenant.contractFilePath,
        fileName: tenant.contractFileName,
        mimeType: tenant.contractMimeType,
        sizeBytes: tenant.contractSizeBytes,
        uploadedAt: tenant.contractUploadedAt,
      };
    }
    return null;
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);

  // Load existing contract info when editing (also fetches signed URL)
  useEffect(() => {
    if (!tenantId) {
      setExistingContract(null);
      setLoaded(true);
      return;
    }

    let cancelled = false;

    fetchTenantContract(tenantId)
      .then((data) => {
        if (!cancelled) {
          setExistingContract(data || null);
        }
      })
      .catch(() => {
        // Keep tenant-based data if API call fails
        if (!cancelled && !existingContract) setExistingContract(null);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const handleFileSelect = useCallback((file) => {
    setSelectedFile(file);
    setError(null);
  }, []);

  const handleFileRemove = useCallback(() => {
    setSelectedFile(null);
    setError(null);
  }, []);

  /**
   * Upload the selected file for the given tenant ID.
   * Returns true on success, false on failure.
   */
  const uploadContract = useCallback(
    async (targetTenantId) => {
      if (!selectedFile) return true; // nothing to upload

      const id = targetTenantId || tenantId;
      if (!id) {
        setError("ID do inquilino nao disponivel para upload.");
        return false;
      }

      setUploading(true);
      setError(null);

      try {
        const result = await uploadTenantContract(id, selectedFile);
        setExistingContract(result);
        setSelectedFile(null);
        return true;
      } catch (err) {
        setError(err?.message || "Erro ao enviar contrato.");
        return false;
      } finally {
        setUploading(false);
      }
    },
    [selectedFile, tenantId]
  );

  /**
   * Delete the existing contract for the given tenant ID.
   */
  const removeContract = useCallback(
    async (targetTenantId) => {
      const id = targetTenantId || tenantId;
      if (!id) return true;
      if (!existingContract) return true;

      setUploading(true);
      setError(null);

      try {
        await deleteTenantContract(id);
        setExistingContract(null);
        return true;
      } catch (err) {
        setError(err?.message || "Erro ao remover contrato.");
        return false;
      } finally {
        setUploading(false);
      }
    },
    [existingContract, tenantId]
  );

  // Whether there is a pending file to upload
  const hasPendingUpload = !!selectedFile;

  // Whether contract was removed (had existing, now has nothing selected)
  const wasRemoved = loaded && !existingContract && !selectedFile;

  return {
    existingContract,
    selectedFile,
    uploading,
    error,
    loaded,
    hasPendingUpload,
    handleFileSelect,
    handleFileRemove,
    uploadContract,
    removeContract,
  };
}
