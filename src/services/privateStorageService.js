import supabase from "../lib/supabaseClient";
import {
  alignUploadPathExtension,
  optimizeFileForUpload,
} from "./fileOptimizationService";

const PRIVATE_BUCKET = "adjuntos";
const REFERENCE_PREFIX = PRIVATE_BUCKET + ":";
const MAX_PRIVATE_FILE_BYTES = 20 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const SIGNED_URL_CACHE_MS = 50 * 60 * 1000;
const signedUrlCache = new Map();

const sanitizePart = (value) =>
  String(value || "")
    .replace(/[^a-zA-Z0-9_.-]/g, "_")
    .replace(/^\.+$/, "_");

const normalizePath = (path) => {
  const normalized = String(path || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .map(sanitizePart)
    .join("/");
  if (!normalized || normalized.includes("..")) {
    throw new Error("La ruta del archivo no es valida.");
  }
  return normalized;
};

const pathFromValue = (value) => {
  const text = String(value || "");
  if (text.startsWith(REFERENCE_PREFIX)) {
    return normalizePath(text.slice(REFERENCE_PREFIX.length));
  }
  const storageMarkers = [
    "/storage/v1/object/public/" + PRIVATE_BUCKET + "/",
    "/storage/v1/object/sign/" + PRIVATE_BUCKET + "/",
  ];
  for (const marker of storageMarkers) {
    const index = text.indexOf(marker);
    if (index >= 0) {
      const encodedPath = text.slice(index + marker.length).split("?")[0];
      return normalizePath(decodeURIComponent(encodedPath));
    }
  }
  return text.startsWith("http://") || text.startsWith("https://") ? null : normalizePath(text);
};

export const privateFileReference = (path) =>
  REFERENCE_PREFIX + normalizePath(path);

export const resolvePrivateFileUrl = async (value, fallbackPath = "") => {
  if (!value && !fallbackPath) return "";

  try {
    const path = fallbackPath ? normalizePath(fallbackPath) : pathFromValue(value);
    if (!path) return value || "";

    const cached = signedUrlCache.get(path);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.url;
    }

    const { data, error } = await supabase.storage
      .from(PRIVATE_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (error) {
      console.warn("No se pudo firmar el archivo privado:", error.message);
      return "";
    }

    const url = data?.signedUrl || "";
    if (url) {
      signedUrlCache.set(path, {
        url,
        expiresAt: Date.now() + SIGNED_URL_CACHE_MS,
      });
    }
    return url;
  } catch {
    return "";
  }
};

export const uploadPrivateFile = async ({
  tenantId,
  relativePath,
  file,
  upsert = true,
  optimizationProfile = "standard",
}) => {
  if (!tenantId) throw new Error("La clinica es obligatoria para subir archivos.");
  if (!file) throw new Error("El archivo es obligatorio.");

  const optimization = await optimizeFileForUpload(file, { profile: optimizationProfile });
  const uploadFile = optimization.file;
  if (Number(uploadFile.size || 0) > MAX_PRIVATE_FILE_BYTES) {
    throw new Error("El archivo supera el limite de 20 MB.");
  }

  const tenantPrefix = sanitizePart(tenantId);
  const optimizedRelativePath = alignUploadPathExtension(relativePath, uploadFile);
  const path = normalizePath(tenantPrefix + "/" + optimizedRelativePath);
  const uploadOptions = {
    upsert,
    cacheControl: "3600",
    ...(uploadFile.type ? { contentType: uploadFile.type } : {}),
  };
  const { error } = await supabase.storage
    .from(PRIVATE_BUCKET)
    .upload(path, uploadFile, uploadOptions);
  if (error) throw error;

  signedUrlCache.delete(path);
  return {
    path,
    reference: privateFileReference(path),
    signedUrl: await resolvePrivateFileUrl("", path),
    originalBytes: optimization.originalBytes,
    storedBytes: optimization.storedBytes,
    savedBytes: optimization.savedBytes,
    optimized: optimization.optimized,
    contentType: uploadFile.type || file.type || "",
  };
};

export const removePrivateFile = async (path) => {
  if (!path) return;
  const normalized = normalizePath(path);
  const { error } = await supabase.storage.from(PRIVATE_BUCKET).remove([normalized]);
  if (error) throw error;
  signedUrlCache.delete(normalized);
};

export default {
  privateFileReference,
  resolvePrivateFileUrl,
  uploadPrivateFile,
  removePrivateFile,
};
