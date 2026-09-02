import assert from 'node:assert/strict'
import test from 'node:test'
import { isAssistantAvailableFromPlugins } from '../src/lib/assistant/availability.ts'

test('bot 插件有 manifest 或入口时启用 AI 能力', () => {
  assert.equal(
    isAssistantAvailableFromPlugins([
      { name: 'bot', manifest: '/bot/manifest.json' },
    ]),
    true
  )
  assert.equal(
    isAssistantAvailableFromPlugins([
      { name: 'bot', entry: '/bot/runtime.js' },
    ]),
    true
  )
})

test('没有可加载的 bot 插件时禁用 AI 能力', () => {
  assert.equal(isAssistantAvailableFromPlugins(undefined), false)
  assert.equal(
    isAssistantAvailableFromPlugins([
      { name: 'crm', manifest: '/crm/manifest.json' },
      { name: 'bot' },
    ]),
    false
  )
})
