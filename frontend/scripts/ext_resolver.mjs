/**
 * TEMPORARY Phase-A harness helper (delete after Slice 1 sign-off).
 *
 * Vite allows extensionless relative imports (`../../maps/utils/geo`), but plain
 * Node ESM requires the extension. This resolver adds it back so we can execute
 * the REAL, UNMODIFIED normalizer against a REAL backend payload without
 * touching a single line of frontend source.
 */
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const CANDIDATES = ["", ".js", ".jsx", "/index.js", "/index.jsx"];

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) {
    const base = new URL(specifier, context.parentURL);
    for (const ext of CANDIDATES) {
      const candidate = new URL(base.href + ext);
      if (existsSync(fileURLToPath(candidate))) {
        return { url: candidate.href, shortCircuit: true, format: ext ? "module" : undefined };
      }
    }
  }
  return nextResolve(specifier, context);
}

export { pathToFileURL };