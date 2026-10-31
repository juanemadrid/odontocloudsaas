// Carga de módulos con reintentos.
// Cada módulo (Caja, Agenda, Facturación…) se descarga la primera vez que se abre. Si en ese
// instante la conexión parpadea o el servidor tarda, la descarga falla y antes se veía una
// pantalla de error por unos segundos. Ahora se reintenta en silencio antes de rendirse.

const MODULE_URL = /(https?:\/\/[^\s'"]+\.js)/i;

export const isChunkLoadError = (error) => {
  const msg = String(error?.message || error || "");
  return /dynamically imported module|Importing a module script failed|Loading chunk|Failed to fetch|error loading dynamically|Unable to preload CSS/i.test(msg);
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {() => Promise<any>} factory  () => import("...")
 * @param {{ retries?: number, delayMs?: number, importUrl?: (url: string) => Promise<any>, sleep?: (ms:number)=>Promise<void> }} [opts]
 */
export async function retryImport(factory, opts = {}) {
  const { retries = 3, delayMs = 700, sleep = wait } = opts;
  const importUrl = opts.importUrl || ((url) => import(/* @vite-ignore */ url));
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      if (attempt === 0) return await factory();
      // Algunos navegadores recuerdan la descarga fallida de la misma dirección:
      // se pide el mismo archivo con un parámetro distinto para forzar una descarga nueva.
      const url = String(lastError?.message || "").match(MODULE_URL)?.[1];
      if (url) {
        const sep = url.includes("?") ? "&" : "?";
        return await importUrl(`${url}${sep}reintento=${attempt}-${Date.now()}`);
      }
      return await factory();
    } catch (error) {
      lastError = error;
      // Un error del propio módulo (no de descarga) no se arregla reintentando.
      if (!isChunkLoadError(error) || attempt === retries) throw error;
      await sleep(delayMs * (attempt + 1));
    }
  }
  throw lastError;
}
