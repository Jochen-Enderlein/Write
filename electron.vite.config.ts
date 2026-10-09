import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { thirdPartyLicenses } from './scripts/third-party-licenses'

const shared = { '@shared': resolve('src/shared') }

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: shared },
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts'),
          indexer: resolve('src/indexer/index.ts'),
          mcp: resolve('src/mcp/server.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: shared },
    build: {
      rollupOptions: {
        input: { index: resolve('src/preload/index.ts') },
        // Sandboxed preloads must be CommonJS
        output: { format: 'cjs', entryFileNames: '[name].cjs' }
      }
    }
  },
  renderer: {
    plugins: [react(), thirdPartyLicenses()],
    experimental: {
      // Vite writes asset URLs as `new URL(file, import.meta.url)` after Rollup has renamed
      // variables, so a library's own top-level `URL` (react-dnd has one) can shadow the global
      // in a shared chunk. Resolving against the page via globalThis avoids that.
      renderBuiltUrl: (file, { hostType }) =>
        hostType === 'js'
          ? { runtime: `new globalThis.URL(${JSON.stringify(file)}, document.baseURI).href` }
          : { relative: true }
    },
    resolve: {
      alias: {
        ...shared,
        '@renderer': resolve('src/renderer/src'),
        // EPL-2.0, not GPL-compatible: Mermaid's optional ELK layout is left out (see the stub)
        'elkjs/lib/elk.bundled.js': resolve('src/renderer/src/editor/elk-stub.ts')
      }
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
          capture: resolve('src/renderer/capture.html'),
          help: resolve('src/renderer/help.html')
        }
      }
    }
  }
})
