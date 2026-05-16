import * as path from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';

// Hooks import from dist/ for production (Node.js native ESM),
// but in tests Vite can transform TypeScript sources directly.
function resolveDistToSrc(): Plugin {
  const distMarker = '/packages/boss-cli/dist/';
  const srcReplace = '/packages/boss-cli/src/';
  return {
    name: 'resolve-dist-to-src',
    resolveId(source, importer) {
      if (!importer) return null;
      if (!source.includes('boss-cli/dist/')) return null;
      const resolved = path.resolve(path.dirname(importer), source);
      if (resolved.includes(distMarker)) {
        const srcPath = resolved.replace(distMarker, srcReplace).replace(/\.js$/, '.ts');
        return srcPath;
      }
      return null;
    }
  };
}

export default defineConfig({
  plugins: [resolveDistToSrc()],
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    restoreMocks: true,
    clearMocks: true,
    testTimeout: 30000
  }
});
