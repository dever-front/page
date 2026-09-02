import {
  getRuntimeConfig,
  type RuntimePluginConfig,
} from '../../config/app-config.ts'

const ASSISTANT_PLUGIN_NAME = 'bot'

export function isAssistantAvailableFromPlugins(
  plugins: RuntimePluginConfig[] | undefined
) {
  return (plugins || []).some(
    (plugin) =>
      plugin.name === ASSISTANT_PLUGIN_NAME &&
      Boolean(plugin.manifest || plugin.entry)
  )
}

export function isAssistantAvailable() {
  return isAssistantAvailableFromPlugins(getRuntimeConfig().plugins)
}
