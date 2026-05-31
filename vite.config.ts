import path from 'path'
import { type PluginOption, defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import { deverFrontSourcePlugins } from './vite-plugin-dever-front'
import { deverRuntimePlugin } from './vite-plugin-runtime'

function frontDependency(name: string) {
  return path.resolve(__dirname, 'node_modules', name)
}

// https://vite.dev/config/
export default defineConfig(async () => {
  const enableRouteGeneration = process.env.VITE_ROUTE_GENERATION !== '0'
  const frontBase = process.env.VITE_FRONT_BASE || '/'
  const frontOutDir = process.env.VITE_FRONT_OUT_DIR || 'dist'
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

  plugins.push(
    deverRuntimePlugin({ projectRoot }),
    deverFrontSourcePlugins({ projectRoot }),
    react(),
    tailwindcss()
  )

  return {
    base: frontBase,
    publicDir: false,
    plugins,
    build: {
      outDir: frontOutDir,
      emptyOutDir: true,
    },
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@': path.resolve(__dirname, './src'),
        react: frontDependency('react'),
        'react-dom': frontDependency('react-dom'),
        '@xyflow/react': frontDependency('@xyflow/react'),
        '@tanstack/react-router': frontDependency('@tanstack/react-router'),
        'lucide-react': frontDependency('lucide-react'),
        sonner: frontDependency('sonner'),
        zustand: frontDependency('zustand'),
        'react/jsx-runtime': frontDependency('react/jsx-runtime.js'),
        'react/jsx-dev-runtime': frontDependency('react/jsx-dev-runtime.js'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      allowedHosts: true,
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
