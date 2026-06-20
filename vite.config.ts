import path from 'path'
import { type PluginOption, defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import { deverRuntimePlugin } from './vite-plugin-runtime'

function frontDependency(name: string) {
  return path.resolve(__dirname, 'node_modules', name)
}

function frontDependencyEntry(name: string) {
  return path.resolve(__dirname, 'node_modules', ...name.split('/'))
}

function isSingleBundleMode(value: string | undefined) {
  return (
    String(value || 'single')
      .trim()
      .toLowerCase() !== 'split'
  )
}

// https://vite.dev/config/
export default defineConfig(async () => {
  const enableRouteGeneration = process.env.VITE_ROUTE_GENERATION !== '0'
  const frontBase = process.env.VITE_FRONT_BASE || '/'
  const frontOutDir = process.env.VITE_FRONT_OUT_DIR || 'dist'
  const singleBundle = isSingleBundleMode(process.env.VITE_FRONT_BUNDLE)
  const allowAllHosts = process.env.VITE_ALLOW_ALL_HOSTS === '1'
  const enablePolling =
    process.env.VITE_FORCE_POLLING === '1' ||
    process.env.CHOKIDAR_USEPOLLING === 'true'
  const pollingInterval = Number(process.env.VITE_POLLING_INTERVAL ?? 800)
  const projectRoot = path.resolve(__dirname, '..')

  const plugins: PluginOption[] = []

  if (enableRouteGeneration) {
    const { tanstackRouter } = await import('@tanstack/router-plugin/vite')
    plugins.push(
      tanstackRouter({
        target: 'react',
        autoCodeSplitting: true,
        disableLogging: true,
      })
    )
  }

  plugins.push(deverRuntimePlugin({ projectRoot }), react(), tailwindcss())

  return {
    base: frontBase,
    publicDir: false,
    plugins,
    build: {
      chunkSizeWarningLimit: 3000,
      outDir: frontOutDir,
      emptyOutDir: true,
      cssCodeSplit: !singleBundle,
      modulePreload: singleBundle ? false : undefined,
      rollupOptions: singleBundle
        ? {
          output: {
            inlineDynamicImports: true,
          },
        }
        : undefined,
    },
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: [
        {
          find: '@dever/front-plugin',
          replacement: path.resolve(
            projectRoot,
            'backend/package/front/sdk/src/index.ts'
          ),
        },
        { find: '@', replacement: path.resolve(__dirname, './src') },
        {
          find: /^zustand$/,
          replacement: frontDependencyEntry('zustand/esm/index.mjs'),
        },
        {
          find: /^zustand\/vanilla$/,
          replacement: frontDependencyEntry('zustand/esm/vanilla.mjs'),
        },
        {
          find: /^zustand\/react$/,
          replacement: frontDependencyEntry('zustand/esm/react.mjs'),
        },
        {
          find: 'react/jsx-dev-runtime',
          replacement: frontDependency('react/jsx-dev-runtime.js'),
        },
        {
          find: 'react/jsx-runtime',
          replacement: frontDependency('react/jsx-runtime.js'),
        },
        { find: 'react', replacement: frontDependency('react') },
        { find: 'react-dom', replacement: frontDependency('react-dom') },
        {
          find: '@xyflow/react',
          replacement: frontDependency('@xyflow/react'),
        },
        {
          find: '@tanstack/react-router',
          replacement: frontDependency('@tanstack/react-router'),
        },
        { find: 'lucide-react', replacement: frontDependency('lucide-react') },
        { find: 'sonner', replacement: frontDependency('sonner') },
      ],
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      allowedHosts: allowAllHosts ? true : undefined,
      fs: {
        allow: [path.resolve(__dirname), path.resolve(projectRoot, 'backend')],
      },
      watch: {
        ignored: [
          '**/.git/**',
          '**/.tanstack/tmp/**',
          '**/.vite/**',
          '**/dist/**',
          '**/node_modules/**',
        ],
        ...(enablePolling
          ? {
            usePolling: true,
            interval: Number.isFinite(pollingInterval)
              ? pollingInterval
              : 800,
          }
          : {}),
      },
    },
  }
})
