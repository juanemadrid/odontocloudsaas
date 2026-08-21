const KB = 1024;
const MB = 1024 * KB;

const IMAGE_MIME_BY_EXTENSION = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  bmp: "image/bmp",
};

const EXTENSION_BY_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const OPTIMIZATION_PROFILES = {
  avatar: {
    skipBelowBytes: 250 * KB,
    targetBytes: 350 * KB,
    maxDimension: 1200,
    minDimension: 720,
    initialQuality: 0.86,
    minimumQuality: 0.7,
    outputType: "image/webp",
  },
  standard: {
    skipBelowBytes: 500 * KB,
    targetBytes: 900 * KB,
    maxDimension: 2400,
    minDimension: 1280,
    initialQuality: 0.88,
    minimumQuality: 0.72,
    outputType: "image/webp",
  },
  clinical: {
    skipBelowBytes: 1 * MB,
    targetBytes: 1.5 * MB,
    maxDimension: 3200,
    minDimension: 2200,
    initialQuality: 0.92,
    minimumQuality: 0.82,
    outputType: null,
  },
};

const unchangedResult = (file) => ({
  file,
  optimized: false,
  originalBytes: Number(file?.size || 0),
  storedBytes: Number(file?.size || 0),
  savedBytes: 0,
});

const getMimeType = (file) => {
  if (file?.type) return String(file.type).toLowerCase();
  const extension = String(file?.name || "").split(".").pop()?.toLowerCase();
  return IMAGE_MIME_BY_EXTENSION[extension] || "";
};

const canOptimizeImage = (file) => {
  const mimeType = getMimeType(file);
  return ["image/jpeg", "image/png", "image/webp", "image/bmp"].includes(mimeType);
};

const loadImageSource = async (file) => {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close?.(),
      };
    } catch {
      // Fall through to the broadly supported HTMLImageElement decoder.
    }
  }

  if (typeof document === "undefined" || typeof URL === "undefined") return null;

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("No se pudo leer la imagen."));
      element.src = objectUrl;
    });

    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
};

const canvasToBlob = (canvas, type, quality) => new Promise((resolve) => {
  canvas.toBlob(resolve, type, quality);
});

const encodeForTarget = async (canvas, outputType, profile) => {
  const first = await canvasToBlob(canvas, outputType, profile.initialQuality);
  if (!first) return null;
  if (first.size <= profile.targetBytes) return first;

  let smallest = first;
  let bestUnderTarget = null;
  let low = profile.minimumQuality;
  let high = profile.initialQuality;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const quality = (low + high) / 2;
    const candidate = await canvasToBlob(canvas, outputType, quality);
    if (!candidate) break;
    if (candidate.size < smallest.size) smallest = candidate;

    if (candidate.size <= profile.targetBytes) {
      bestUnderTarget = candidate;
      low = quality;
    } else {
      high = quality;
    }
  }

  if (bestUnderTarget) return bestUnderTarget;

  const minimumQualityBlob = await canvasToBlob(
    canvas,
    outputType,
    profile.minimumQuality
  );
  if (minimumQualityBlob && minimumQualityBlob.size < smallest.size) {
    smallest = minimumQualityBlob;
  }
  return smallest;
};

const optimizedName = (originalName, mimeType) => {
  const extension = EXTENSION_BY_MIME[mimeType];
  if (!extension) return originalName || "archivo";
  const name = String(originalName || "archivo");
  return /\.[^.]+$/.test(name)
    ? name.replace(/\.[^.]+$/, `.${extension}`)
    : `${name}.${extension}`;
};

export const alignUploadPathExtension = (path, file) => {
  const extension = EXTENSION_BY_MIME[getMimeType(file)];
  if (!extension) return path;

  const value = String(path || "");
  const slashIndex = value.lastIndexOf("/");
  const dotIndex = value.lastIndexOf(".");
  if (dotIndex > slashIndex) return `${value.slice(0, dotIndex)}.${extension}`;
  return `${value}.${extension}`;
};

export const optimizeFileForUpload = async (file, options = {}) => {
  if (!file || !canOptimizeImage(file)) return unchangedResult(file);
  if (typeof document === "undefined" && typeof OffscreenCanvas === "undefined") {
    return unchangedResult(file);
  }

  const profile = OPTIMIZATION_PROFILES[options.profile] || OPTIMIZATION_PROFILES.standard;
  if (Number(file.size || 0) <= profile.skipBelowBytes) return unchangedResult(file);

  let decoded;
  try {
    decoded = await loadImageSource(file);
    if (!decoded?.width || !decoded?.height) return unchangedResult(file);

    const inputType = getMimeType(file);
    const outputType = profile.outputType
      || (inputType === "image/jpeg" ? "image/jpeg" : "image/webp");
    const naturalMaxDimension = Math.max(decoded.width, decoded.height);
    let requestedMaxDimension = Math.min(naturalMaxDimension, profile.maxDimension);
    let bestBlob = null;

    for (let resizeAttempt = 0; resizeAttempt < 3; resizeAttempt += 1) {
      const scale = Math.min(1, requestedMaxDimension / naturalMaxDimension);
      const width = Math.max(1, Math.round(decoded.width * scale));
      const height = Math.max(1, Math.round(decoded.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d", { alpha: outputType !== "image/jpeg" });
      if (!context) return unchangedResult(file);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(decoded.source, 0, 0, width, height);

      const candidate = await encodeForTarget(canvas, outputType, profile);
      canvas.width = 1;
      canvas.height = 1;
      if (!candidate) return unchangedResult(file);

      if (!bestBlob || candidate.size < bestBlob.size) bestBlob = candidate;
      if (candidate.size <= profile.targetBytes * 1.05) break;

      const currentMaxDimension = Math.max(width, height);
      if (currentMaxDimension <= profile.minDimension) break;
      const reduction = Math.max(
        0.72,
        Math.min(0.92, Math.sqrt(profile.targetBytes / candidate.size) * 0.96)
      );
      const nextMaxDimension = Math.max(
        profile.minDimension,
        Math.floor(currentMaxDimension * reduction)
      );
      if (nextMaxDimension >= currentMaxDimension) break;
      requestedMaxDimension = nextMaxDimension;

      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    if (!bestBlob || bestBlob.size >= Number(file.size || 0) * 0.92) {
      return unchangedResult(file);
    }

    const optimizedFile = new File(
      [bestBlob],
      optimizedName(file.name, bestBlob.type || outputType),
      {
        type: bestBlob.type || outputType,
        lastModified: file.lastModified || Date.now(),
      }
    );

    return {
      file: optimizedFile,
      optimized: true,
      originalBytes: Number(file.size || 0),
      storedBytes: optimizedFile.size,
      savedBytes: Math.max(0, Number(file.size || 0) - optimizedFile.size),
    };
  } catch (error) {
    console.warn("No fue posible optimizar la imagen; se conservará el original.", error);
    return unchangedResult(file);
  } finally {
    decoded?.release?.();
  }
};

export default {
  optimizeFileForUpload,
  alignUploadPathExtension,
};
