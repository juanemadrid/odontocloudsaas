/**
 * Custom ESM Loader hook for FEV-RIPS test suites.
 * Intercepts modules using Vite's `import.meta.env` in Node.js and safely provides
 * local-only defaults without modifying source files or repository baseline.
 */

export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context);

  if (result.format === 'module' && result.source) {
    const src = typeof result.source === 'string' ? result.source : Buffer.from(result.source).toString('utf8');
    if (src.includes('import.meta.env')) {
      const transformedSource = src.replaceAll(
        'import.meta.env',
        '(globalThis.__test_env || { VITE_SUPABASE_URL: "http://127.0.0.1:54321", VITE_SUPABASE_ANON_KEY: "mock-local-anon-key" })'
      );
      return {
        ...result,
        source: transformedSource
      };
    }
  }

  return result;
}
