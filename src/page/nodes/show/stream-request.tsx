import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useStore } from 'zustand'
import { Loader2, Send, Square } from 'lucide-react'
import {
  EnergonContentView,
  type EnergonOutput,
} from '@/components/energon/content-view'
import { Button } from '@/components/ui/button'
import { SearchableOptionPicker } from '@/components/searchable-option-picker'
import { request } from '@/lib/request'
import {
  runRuntimeStream,
  stopRuntimeStream,
} from '@/lib/runtime-stream-runner'
import {
  streamValueText as valueText,
  type RuntimeStreamFrame,
} from '@/lib/stream'
import {
  mergeResourceUploadRules,
  normalizeResourceUploadRules,
} from '@/lib/resource'
import { getStoreValueByPath } from '@/lib/store'
import {
  isEmptyRuntimeOutput,
  normalizeRuntimeFrameOutput,
  resolveRuntimeFrameCancelable,
  runtimeErrorMessage,
} from '@/lib/runtime-stream-output'
import { useUploadRuleMetas } from '@/hooks/use-upload-rule-metas'
import type { NodeItemProps } from '../../nodes'
import {
  PowerParamPopover,
  PowerParamField,
  buildDefaultParamValues,
  buildRequestInput,
  inputKeyForParam,
  isHiddenParam,
  isMainParam,
  isToolbarParam,
  normalizePowerParamConfig,
  paramFilesRequestValue,
  validateMainParams,
  type ParamFileMap,
  type ParamUploadedFile,
  type ParamValueMap,
  type PowerParamSource,
  type PowerParam,
} from './stream-request-params'
import {
  StreamTimingBadge,
  cancelStreamTiming,
  createStreamTiming,
  finishStreamTiming,
  isStreamTimingStatusOutput,
  markStreamTimingStopping,
  updateStreamTimingFromOutput,
  useStreamClock,
  type StreamTiming,
} from './shared/stream-timing'

type StreamFrame = RuntimeStreamFrame<EnergonOutput>

type StreamOutput = {
  text: string
  reasoning: string
  finalOutput: EnergonOutput | null
}

const SOURCE_RULE_PICK = 2

const EMPTY_OUTPUT: StreamOutput = {
  text: '',
  reasoning: '',
  finalOutput: null,
}

export function ShowStreamRequest({ item, store }: NodeItemProps) {
  const [requestID, setRequestID] = useState('')
  const [lastStreamID, setLastStreamID] = useState('0-0')
  const [running, setRunning] = useState(false)
  const [cancelable, setCancelable] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [error, setError] = useState('')
  const [output, setOutput] = useState<StreamOutput>(EMPTY_OUTPUT)
  const [timing, setTiming] = useState<StreamTiming | undefined>()
  const [paramsLoading, setParamsLoading] = useState(false)
  const [powerParams, setPowerParams] = useState<PowerParam[]>([])
  const [powerSources, setPowerSources] = useState<PowerParamSource[]>([])
  const [sourceRule, setSourceRule] = useState(1)
  const [selectedSource, setSelectedSource] = useState({ power: '', id: '' })
  const [paramValues, setParamValues] = useState<ParamValueMap>({})
  const [paramFiles, setParamFiles] = useState<ParamFileMap>({})
  const [requestIDCopied, setRequestIDCopied] = useState(false)
  const runTokenRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const requestIDCopyTimerRef = useRef<number | null>(null)
  const outputScrollRef = useRef<HTMLDivElement | null>(null)
  const autoScrollRef = useRef(true)

  const powerKey = useStore(store, () =>
    valueText(getStoreValueByPath(store, String(item.meta?.powerPath || '')))
  )
  const activeSelectedSourceID = selectedSource.power === powerKey ? selectedSource.id : ''
  const requestApi = String(item.meta?.requestApi || '/bot/energon/request')
  const paramApi = String(item.meta?.paramApi || '/bot/energon/power_params')
  const streamApi = String(item.meta?.streamApi || '/bot/energon/stream')
  const stopApi = String(item.meta?.stopApi || '/bot/energon/stream_stop')
  const blockMs = Number(item.meta?.blockMs || 1000)
  const rawUploadRules = useMemo(
    () => normalizeResourceUploadRules(item.meta?.uploadRules),
    [item.meta?.uploadRules]
  )
  const paramUploadRuleIds = useMemo(
    () =>
      powerParams
        .map((param) => Number(param.upload_rule_id || 0))
        .filter((ruleId) => Number.isFinite(ruleId) && ruleId > 0),
    [powerParams]
  )
  const uploadRuleMetas = useUploadRuleMetas([
    ...rawUploadRules.map((current) => current.ruleId),
    ...paramUploadRuleIds,
  ])
  const uploadRules = useMemo(
    () => mergeResourceUploadRules(rawUploadRules, uploadRuleMetas),
    [rawUploadRules, uploadRuleMetas]
  )
  const mainPowerParams = useMemo(
    () =>
      powerParams.filter((param) => isMainParam(param) && !isHiddenParam(param)),
    [powerParams]
  )
  const toolbarPowerParams = useMemo(
    () =>
      powerParams.filter((param) => isToolbarParam(param) && !isHiddenParam(param)),
    [powerParams]
  )
  const hasConfiguredParams = powerParams.length > 0
  const sourcePickerOptions = useMemo(
    () => powerSources.map((source) => ({ id: source.id, value: source.name })),
    [powerSources]
  )
  const sourceReady =
    sourceRule !== SOURCE_RULE_PICK || activeSelectedSourceID.length > 0
  const nowMs = useStreamClock(timing?.status === 'running')

  const canSend = useMemo(
    () =>
      hasConfiguredParams &&
      sourceReady &&
      !running &&
      !paramsLoading &&
      powerKey.length > 0,
    [hasConfiguredParams, paramsLoading, powerKey, running, sourceReady]
  )

  useEffect(() => {
    return () => {
      runTokenRef.current += 1
      abortRef.current?.abort()
      clearRequestIDCopyTimer(requestIDCopyTimerRef)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setPowerParams([])
    setPowerSources([])
    setParamValues({})
    setParamFiles({})
    setError('')

    if (!powerKey) {
      setSourceRule(1)
      setParamsLoading(false)
      return () => {
        cancelled = true
      }
    }

    async function loadPowerParams() {
      setParamsLoading(true)
      const result = await request(paramApi, 'get', {
        power: powerKey,
        include_sources: 1,
        source_target_id: activeSelectedSourceID,
      })
      if (cancelled) {
        return
      }
      if (result.code !== 0) {
        setParamsLoading(false)
        setError(result.message || '读取能力参数失败。')
        return
      }

      const config = normalizePowerParamConfig(result.data)
      const rows = config.params
      setSourceRule(config.sourceRule)
      setPowerSources(config.sources)
      if (
        config.selectedSourceID &&
        config.selectedSourceID !== activeSelectedSourceID
      ) {
        setSelectedSource({ power: powerKey, id: config.selectedSourceID })
      }
      setPowerParams(rows)
      setParamValues(buildDefaultParamValues(rows))
      setParamsLoading(false)
    }

    void loadPowerParams()
    return () => {
      cancelled = true
    }
  }, [activeSelectedSourceID, paramApi, powerKey])

  useEffect(() => {
    const element = outputScrollRef.current
    if (!element || !autoScrollRef.current) {
      return
    }
    scrollOutputToBottom(element)
    const timer = window.setTimeout(() => scrollOutputToBottom(element), 0)
    return () => {
      window.clearTimeout(timer)
    }
  }, [output, running])

  const handleOutputScroll = () => {
    const element = outputScrollRef.current
    if (!element) {
      return
    }
    autoScrollRef.current = isScrolledToBottom(element)
  }

  const stop = async () => {
    if (!requestID || !cancelable || stopping) {
      return
    }
    setStopping(true)
    setError('')
    setTiming((current) => markStreamTimingStopping(current))
    abortRef.current?.abort()
    try {
      await stopRuntimeStream(requestID, stopApi)
      runTokenRef.current += 1
      setRunning(false)
      setCancelable(false)
      setTiming((current) => cancelStreamTiming(current))
    } catch (currentError: unknown) {
      setError(runtimeErrorMessage(currentError, '停止任务失败。'))
    } finally {
      setStopping(false)
    }
  }

  const send = async () => {
    if (!powerKey) {
      setError('未选择能力。')
      return
    }
    const validationError = validateMainParams(powerParams, paramValues)
    if (validationError) {
      setError(validationError)
      return
    }

    const token = runTokenRef.current + 1
    runTokenRef.current = token
    setRunning(true)
    setError('')
    setOutput(EMPTY_OUTPUT)
    setTiming(createStreamTiming('等待生成结果'))
    setRequestID('')
    setRequestIDCopied(false)
    setLastStreamID('0-0')
    setCancelable(false)
    setStopping(false)
    autoScrollRef.current = true
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const body: Record<string, unknown> = {
        power: powerKey,
        input: buildRequestInput(powerParams, paramValues),
        history: [],
        options: {
          stream: true,
        },
      }
      if (sourceRule === SOURCE_RULE_PICK && activeSelectedSourceID) {
        body.source_target_id = activeSelectedSourceID
      }

      await runRuntimeStream<EnergonOutput>({
        requestApi,
        streamApi,
        stopApi,
        stopOnAbort: false,
        body,
        blockMs,
        signal: controller.signal,
        onRequestID: setRequestID,
        onFrame: (frame) => {
          if (runTokenRef.current !== token || controller.signal.aborted) {
            return
          }
          const streamID = valueText(frame?.stream_id)
          if (streamID) {
            setLastStreamID(streamID)
          }
          applyFrame(frame)
        },
      })
    } catch (currentError: unknown) {
      if (runTokenRef.current === token) {
        setError(runtimeErrorMessage(currentError, '测试失败。'))
        setTiming((current) => finishStreamTiming(current, 'failed'))
      }
    } finally {
      if (runTokenRef.current === token) {
        setRunning(false)
      }
      if (abortRef.current === controller) {
        abortRef.current = null
      }
    }
  }

  const applyFrame = (frame: StreamFrame) => {
    const frameOutput = normalizeRuntimeFrameOutput(frame?.output, frame)
    if (isEmptyRuntimeOutput(frameOutput) && frame.type !== 'result') {
      return
    }
    const frameCancelable = resolveRuntimeFrameCancelable(frame)
    if (frameCancelable != null) {
      setCancelable(frameCancelable)
    }
    const event = valueText(frameOutput.event).toLowerCase()
    if (isStreamTimingStatusOutput(frameOutput)) {
      setTiming((current) => updateStreamTimingFromOutput(current, frameOutput))
    }
    if (frame.type === 'result') {
      setTiming((current) =>
        finishStreamTiming(
          current,
          Number(frame.status) === 2 ? 'failed' : 'done'
        )
      )
    }

    setOutput((current) => {
      if (valueText(frameOutput.event).toLowerCase() === 'control') {
        return current
      }
      if (frame.type === 'result') {
        return {
          ...current,
          finalOutput: isEmptyRuntimeOutput(frameOutput)
            ? { text: current.text || valueText(frame?.msg) }
            : frameOutput,
        }
      }

      const next: StreamOutput = {
        text: current.text,
        reasoning: current.reasoning,
        finalOutput: current.finalOutput,
      }

      if (event === 'delta' || (!event && frameOutput.text)) {
        next.text += valueText(frameOutput.text)
      }
      if (event === 'reasoning' || frameOutput.reasoning) {
        next.reasoning += valueText(frameOutput.reasoning || frameOutput.text)
      }
      return next
    })
  }

  const setParamValue = (param: PowerParam, nextValue: unknown) => {
    const key = inputKeyForParam(param)
    if (!key) {
      return
    }
    setParamValues((current) => ({
      ...current,
      [key]: nextValue,
    }))
  }

  const setParamFileValue = (param: PowerParam, nextFiles: ParamUploadedFile[]) => {
    const key = inputKeyForParam(param)
    if (!key) {
      return
    }
    setParamFiles((current) => ({
      ...current,
      [key]: nextFiles,
    }))
    setParamValues((current) => ({
      ...current,
      [key]: paramFilesRequestValue(param, nextFiles),
    }))
  }

  const copyRequestID = async () => {
    const value = requestID.trim()
    if (!value) {
      return
    }

    try {
      await copyTextToClipboard(value)
      setRequestIDCopied(true)
      clearRequestIDCopyTimer(requestIDCopyTimerRef)
      requestIDCopyTimerRef.current = window.setTimeout(() => {
        setRequestIDCopied(false)
        requestIDCopyTimerRef.current = null
      }, 1200)
    } catch {
      setError('复制 RequestID 失败。')
    }
  }

  return (
    <div
      className="grid min-h-0 gap-4 md:grid-cols-[minmax(340px,420px)_1px_minmax(0,1fr)]"
      style={{ height: 'min(60vh, 600px)' }}
    >
      <div className="flex min-h-0 flex-col gap-3">
        <div className="min-h-0 flex-1 overflow-y-auto rounded-xl bg-background/70 p-3">
          {paramsLoading ? (
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              读取参数
            </span>
          ) : null}

          {sourceRule === SOURCE_RULE_PICK && powerSources.length > 0 ? (
            <div className="mb-3">
              <SearchableOptionPicker
                value={activeSelectedSourceID || undefined}
                options={sourcePickerOptions}
                disabled={running || paramsLoading}
                placeholder="请选择来源"
                clearable={false}
                onChange={(nextValue) => {
                  const sourceID = Array.isArray(nextValue) ? nextValue[0] || '' : nextValue
                  setSelectedSource({ power: powerKey, id: String(sourceID || '') })
                }}
              />
            </div>
          ) : null}

          {mainPowerParams.length > 0 ? (
            <div className="space-y-3">
              {mainPowerParams.map((param) => {
                const key = inputKeyForParam(param)
                return (
                  <PowerParamField
                    key={`${param.id}-${key}`}
                    param={param}
                    value={paramValues[key]}
                    files={paramFiles[key] || []}
                    uploadRuleMeta={uploadRuleMetas.get(Number(param.upload_rule_id || 0))}
                    disabled={running}
                    onChange={(nextValue) => setParamValue(param, nextValue)}
                    onFilesChange={(nextFiles) => setParamFileValue(param, nextFiles)}
                  />
                )
              })}
            </div>
          ) : !paramsLoading ? (
            <div className="rounded-lg px-3 py-8 text-center text-sm text-muted-foreground">
              暂无参数配置。
            </div>
          ) : null}

          {toolbarPowerParams.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
              {toolbarPowerParams.map((param) => {
                const key = inputKeyForParam(param)
                return (
                  <PowerParamPopover
                    key={`${param.id}-${key}`}
                    param={param}
                    value={paramValues[key]}
                    files={paramFiles[key] || []}
                    uploadRuleMeta={uploadRuleMetas.get(Number(param.upload_rule_id || 0))}
                    disabled={running}
                    onChange={(nextValue) => setParamValue(param, nextValue)}
                    onFilesChange={(nextFiles) => setParamFileValue(param, nextFiles)}
                  />
                )
              })}
            </div>
          ) : null}

          {error ? (
            <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
        </div>

        {hasConfiguredParams ? (
          <div className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-background px-3 py-3">
            {running ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!cancelable || stopping}
                onClick={() => void stop()}
              >
                {stopping ? (
                  <Loader2 className="mr-2 size-3.5 animate-spin" />
                ) : (
                  <Square className="mr-2 size-3.5" />
                )}
                {cancelable ? '停止' : '不可停止'}
              </Button>
            ) : null}
            <Button type="button" size="sm" disabled={!canSend} onClick={() => void send()}>
              {running ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Send className="mr-2 size-4" />
              )}
              {running ? '生成中...' : '生成'}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="hidden bg-border md:block" aria-hidden="true" />

      <div className="flex min-h-0 flex-col overflow-hidden rounded-xl bg-background">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b px-3 py-2">
          <span className="text-sm font-medium text-foreground">测试结果</span>
          {requestID ? (
            <button
              type="button"
              className="flex min-w-0 max-w-[70%] items-center justify-end rounded-md px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
              title={`双击复制完整 RequestID：${requestID}${
                lastStreamID !== '0-0' ? ` / StreamID: ${lastStreamID}` : ''
              }`}
              onDoubleClick={() => void copyRequestID()}
            >
              <span className="mr-1 shrink-0">RequestID:</span>
              <span className="min-w-0 truncate font-mono">{requestID}</span>
              {requestIDCopied ? (
                <span className="ml-2 shrink-0 text-primary">已复制</span>
              ) : null}
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">暂无 RequestID</span>
          )}
        </div>
        <div
          ref={outputScrollRef}
          onScroll={handleOutputScroll}
          style={{ scrollbarGutter: 'stable' }}
          className="min-h-0 flex-1 overflow-y-scroll p-3"
        >
          {timing ? (
            <div className="mb-3">
              <StreamTimingBadge timing={timing} now={nowMs} />
            </div>
          ) : null}
          <EnergonContentView
            output={buildContentViewOutput(output)}
            streaming={running && hasStreamingTextOutput(output)}
            emptyText="AI 返回内容会显示在这里。"
            uploadRules={uploadRules}
          />
        </div>
      </div>
    </div>
  )
}

function isScrolledToBottom(element: HTMLElement) {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= 24
}

function scrollOutputToBottom(element: HTMLElement) {
  element.scrollTop = element.scrollHeight
}

function buildContentViewOutput(output: StreamOutput): EnergonOutput[] | EnergonOutput {
  if (output.finalOutput) {
    return output.finalOutput
  }

  const items: EnergonOutput[] = []
  if (output.reasoning) {
    items.push({ event: 'reasoning', reasoning: output.reasoning })
  }
  if (output.text) {
    items.push({ text: output.text })
  }
  return items
}

function hasStreamingTextOutput(output: StreamOutput) {
  return (
    !output.finalOutput && (Boolean(output.text) || Boolean(output.reasoning))
  )
}

function clearRequestIDCopyTimer(timerRef: { current: number | null }) {
  if (timerRef.current == null) {
    return
  }
  window.clearTimeout(timerRef.current)
  timerRef.current = null
}

async function copyTextToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  textarea.remove()
  if (!copied) {
    throw new Error('copy failed')
  }
}
