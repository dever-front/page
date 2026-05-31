import path from 'path'
import { type PluginOption, defineConfig } from 'vite'
import fs from 'node:fs'

const pluginRoot = process.env.DEVER_FRONT_PLUGIN_ROOT
const pluginName = process.env.DEVER_FRONT_PLUGIN_NAME || 'plugin'

if (!pluginRoot) {
  throw new Error('DEVER_FRONT_PLUGIN_ROOT is required')
}

const runtimeEntryID = 'virtual:dever-front-plugin-runtime'
const resolvedRuntimeEntryID = '\0' + runtimeEntryID
const explicitRuntimeEntry = path.join(pluginRoot, 'src', 'runtime.ts')
const pluginEntry = path.join(pluginRoot, 'src', 'plugin.ts')

function frontDependency(name: string) {
  return path.resolve(__dirname, 'node_modules', name)
}

function runtimeEntryPlugin(): PluginOption {
  return {
    name: 'dever-front-plugin-runtime-entry',
    resolveId(id) {
      return id === runtimeEntryID ? resolvedRuntimeEntryID : null
    },
    load(id) {
      if (id !== resolvedRuntimeEntryID) {
        return null
      }
      return [
        `import plugin from ${JSON.stringify(pluginEntry)}`,
        'window.DeverFront?.registerPlugin(plugin)',
      ].join('\n')
    },
  }
}

export default defineConfig({
  root: pluginRoot,
  plugins: [runtimeEntryPlugin()],
  esbuild: {
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    jsxInject: "import React from 'react'",
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
  build: {
    outDir: path.join(pluginRoot, 'dist'),
    emptyOutDir: true,
    manifest: 'manifest.json',
    lib: {
      entry: fs.existsSync(explicitRuntimeEntry)
        ? explicitRuntimeEntry
        : runtimeEntryID,
      formats: ['iife'],
      name: `${pluginName.replace(/[^a-zA-Z0-9_$]/g, '_')}FrontPlugin`,
      fileName: () => `${pluginName}.js`,
    },
    rollupOptions: {
      external: ['react'],
      output: {
        globals: {
          react: 'React',
        },
        inlineDynamicImports: true,
      },
    },
  },
})
