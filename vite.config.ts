import path from 'path'
import { type PluginOption, defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(async () => {
  const enableRouteGeneration = process.env.VITE_ROUTE_GENERATION === '1'
  const enablePolling =
    process.env.VITE_FORCE_POLLING === '1' ||
    process.env.CHOKIDAR_USEPOLLING === 'true'
  const pollingInterval = Number(process.env.VITE_POLLING_INTERVAL ?? 800)

  const plugins: PluginOption[] = []

  if (enableRouteGeneration) {
    const { tanstackRouter } = await import('@tanstack/router-plugin/vite')
    plugins.push(
      tanstackRouter({
        target: 'react',
        autoCodeSplitting: true,
      })
    )
  }

  plugins.push(react(), tailwindcss())

  return {
    plugins,
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@': path.resolve(__dirname, './src'),
        react: path.resolve(__dirname, './node_modules/react'),
        'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
        'react/jsx-runtime': path.resolve(
          __dirname,
          './node_modules/react/jsx-runtime.js'
        ),
        'react/jsx-dev-runtime': path.resolve(
          __dirname,
          './node_modules/react/jsx-dev-runtime.js'
        ),
      },
    },
    server: {
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
