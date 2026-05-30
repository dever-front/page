import path from 'path'
import { defineConfig } from 'vite'

const pluginRoot = process.env.DEVER_FRONT_PLUGIN_ROOT
const pluginName = process.env.DEVER_FRONT_PLUGIN_NAME || 'plugin'

if (!pluginRoot) {
  throw new Error('DEVER_FRONT_PLUGIN_ROOT is required')
}

export default defineConfig({
  root: pluginRoot,
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
      react: path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
      '@xyflow/react': path.resolve(
        __dirname,
        './node_modules/@xyflow/react'
      ),
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
  build: {
    outDir: path.join(pluginRoot, 'dist'),
    emptyOutDir: true,
    manifest: 'manifest.json',
    lib: {
      entry: path.join(pluginRoot, 'src', 'runtime.ts'),
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
