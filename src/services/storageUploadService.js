import supabase from "../lib/supabaseClient";
import {
  alignUploadPathExtension,
  optimizeFileForUpload,
} from "./fileOptimizationService";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export const uploadOptimizedPublicFile = async ({
  bucket,
  path,
  file,
  profile = "standard",
  upsert = false,
}) => {
  if (!bucket) throw new Error("El bucket de destino es obligatorio.");
  if (!path) throw new Error("La ruta del archivo es obligatoria.");
  if (!file) throw new Error("El archivo es obligatorio.");

  const optimization = await optimizeFileForUpload(file, { profile });
  const uploadFile = optimization.file;
  if (Number(uploadFile.size || 0) > MAX_UPLOAD_BYTES) {
    throw new Error("El archivo sigue superando 20 MB después de optimizarlo.");
  }

  const uploadPath = alignUploadPathExtension(path, uploadFile);
  const { error } = await supabase.storage.from(bucket).upload(uploadPath, uploadFile, {
    upsert,
    cacheControl: "3600",
    ...(uploadFile.type ? { contentType: uploadFile.type } : {}),
  });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(uploadPath);
  return {
    path: uploadPath,
    publicUrl: data?.publicUrl || "",
    contentType: uploadFile.type || file.type || "",
    originalBytes: optimization.originalBytes,
    storedBytes: optimization.storedBytes,
    savedBytes: optimization.savedBytes,
    optimized: optimization.optimized,
  };
};

export default {
  uploadOptimizedPublicFile,
};
