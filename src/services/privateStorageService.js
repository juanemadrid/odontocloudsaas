import supabase from "../lib/supabaseClient";

const PRIVATE_BUCKET = "adjuntos";
const REFERENCE_PREFIX = PRIVATE_BUCKET + ":";

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
  const marker = "/storage/v1/object/public/" + PRIVATE_BUCKET + "/";
  const index = text.indexOf(marker);
  if (index >= 0) {
    return normalizePath(decodeURIComponent(text.slice(index + marker.length)));
  }
  return text.startsWith("http://") || text.startsWith("https://") ? null : normalizePath(text);
};

export const privateFileReference = (path) =>
  REFERENCE_PREFIX + normalizePath(path);

export const resolvePrivateFileUrl = async (value, fallbackPath = "") => {
  // Si no hay valor ni fallback, retornar vacío sin procesar
  if (!value && !fallbackPath) return "";
  
  try {
    const path = fallbackPath ? normalizePath(fallbackPath) : pathFromValue(value);
    if (!path) return value || "";
    const { data, error } = await supabase.storage
      .from(PRIVATE_BUCKET)
      .createSignedUrl(path, 60 * 60);
    if (error) {
      console.warn("No se pudo firmar el archivo privado:", error.message);
      return "";
    }
    return data?.signedUrl || "";
  } catch (e) {
    // Ruta inválida o bucket no encontrado — retornar vacío silenciosamente
    return "";
  }
};

export const uploadPrivateFile = async ({ tenantId, relativePath, file, upsert = true }) => {
  if (!tenantId) throw new Error("La clinica es obligatoria para subir archivos.");
  if (!file) throw new Error("El archivo es obligatorio.");
  const tenantPrefix = sanitizePart(tenantId);
  const path = normalizePath(tenantPrefix + "/" + relativePath);
  const { error } = await supabase.storage
    .from(PRIVATE_BUCKET)
    .upload(path, file, { upsert });
  if (error) throw error;
  return {
    path,
    reference: privateFileReference(path),
    signedUrl: await resolvePrivateFileUrl("", path),
  };
};

export const removePrivateFile = async (path) => {
  if (!path) return;
  const normalized = normalizePath(path);
  const { error } = await supabase.storage.from(PRIVATE_BUCKET).remove([normalized]);
  if (error) throw error;
};

export default {
  privateFileReference,
  resolvePrivateFileUrl,
  uploadPrivateFile,
  removePrivateFile,
};
