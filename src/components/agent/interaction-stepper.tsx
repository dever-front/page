import { useEffect, useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Send,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { UploadRuleMeta } from '@/lib/upload'
import { cn } from '@/lib/utils'
import {
  PowerParamField,
  inputKeyForParam,
  validateMainParams,
  type ParamFileMap,
  type ParamUploadedFile,
  type ParamValueMap,
  type PowerParam,
} from './stream-request-params'
import {
  InteractionStepperChoice,
  type InteractionStepperParam,
} from './interaction-stepper-choice'

export type { InteractionStepperParam } from './interaction-stepper-choice'

type InteractionStepperProps = {
  params: InteractionStepperParam[]
  values: ParamValueMap
  files: ParamFileMap
  uploadRuleMetas: Map<number, UploadRuleMeta>
  disabled?: boolean
  error?: string
  onValueChange: (param: PowerParam, value: unknown) => void
  onFilesChange: (param: PowerParam, files: ParamUploadedFile[]) => void
  onSubmit: (values?: ParamValueMap) => void
}

export function AgentInteractionStepper({
  params,
  values,
  files,
  uploadRuleMetas,
  disabled,
  error,
  onValueChange,
  onFilesChange,
  onSubmit,
}: InteractionStepperProps) {
  const [step, setStep] = useState(0)
  const [stepError, setStepError] = useState('')
  const [customOpen, setCustomOpen] = useState<Record<string, boolean>>({})
  const [customValues, setCustomValues] = useState<Record<string, string>>({})
  const currentParam = params[step]
  const currentKey = currentParam ? inputKeyForParam(currentParam) : ''
  const remainingParams = useMemo(() => params.slice(step), [params, step])
  const canDelegateRemaining =
    remainingParams.length > 0 &&
    remainingParams.every((param) => param.recommendedValues.length > 0)

  useEffect(() => {
    setStep((current) => Math.min(current, Math.max(params.length - 1, 0)))
  }, [params.length])

  useEffect(() => {
    setStepError('')
  }, [step])

  if (!currentParam) {
    return (
      <div className='p-4'>
        <div className='text-sm text-muted-foreground'>
          当前没有需要确认的信息。
        </div>
        <div className='mt-4 flex justify-end'>
          <Button
            type='button'
            size='sm'
            disabled={disabled}
            onClick={() => onSubmit()}
          >
            <Send className='size-3.5' />
            继续
          </Button>
        </div>
      </div>
    )
  }

  const updateValue = (value: unknown) => {
    setStepError('')
    onValueChange(currentParam, value)
  }

  const goNext = () => {
    const validationError = validateMainParams([currentParam], values)
    if (validationError) {
      setStepError(validationError)
      return
    }
    if (step < params.length - 1) {
      setStep((current) => current + 1)
      return
    }
    onSubmit()
  }

  const delegateRemaining = () => {
    if (!canDelegateRemaining) {
      return
    }
    const nextValues = { ...values }
    for (const param of remainingParams) {
      const key = inputKeyForParam(param)
      if (!key || hasInteractionValue(nextValues[key])) {
        continue
      }
      nextValues[key] =
        param.type === 'multi_option'
          ? [...param.recommendedValues]
          : param.recommendedValues[0]
    }
    onSubmit(nextValues)
  }

  return (
    <div className='flex min-h-0 flex-col'>
      <div
        data-agent-interaction-scroll='true'
        className='max-h-[58vh] overflow-y-auto overscroll-contain px-4 py-4 sm:px-5'
      >
        <StepperProgress step={step} total={params.length} />

        {isChoiceParam(currentParam) ? (
          <div className='mt-4 text-base font-medium leading-6 text-foreground'>
            {currentParam.name || currentKey}
          </div>
        ) : null}

        <div className={isChoiceParam(currentParam) ? 'mt-3' : 'mt-4'}>
          {isChoiceParam(currentParam) ? (
            <InteractionStepperChoice
              param={currentParam}
              value={values[currentKey]}
              disabled={disabled}
              customOpen={Boolean(customOpen[currentKey])}
              customValue={customValues[currentKey] || ''}
              onChange={updateValue}
              onCustomOpen={() =>
                setCustomOpen((current) => ({ ...current, [currentKey]: true }))
              }
              onCustomValueChange={(value) =>
                setCustomValues((current) => ({
                  ...current,
                  [currentKey]: value,
                }))
              }
            />
          ) : (
            <PowerParamField
              param={currentParam}
              value={values[currentKey]}
              files={files[currentKey] || []}
              uploadRuleMeta={uploadRuleMetas.get(
                Number(currentParam.upload_rule_id || 0)
              )}
              disabled={disabled}
              onChange={updateValue}
              onFilesChange={(nextFiles) =>
                onFilesChange(currentParam, nextFiles)
              }
            />
          )}
        </div>

        {error || stepError ? (
          <div className='mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive'>
            {error || stepError}
          </div>
        ) : null}
      </div>

      <div className='flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 sm:px-5'>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          disabled={disabled || !canDelegateRemaining}
          className='px-2 text-muted-foreground'
          title={
            canDelegateRemaining
              ? '使用 AI 推荐值完成当前及后续问题'
              : '存在没有推荐值的问题，请逐项确认'
          }
          onClick={delegateRemaining}
        >
          <Sparkles className='size-3.5' />
          剩余全部交给 AI 决定
        </Button>

        <div className='flex items-center gap-2'>
          {step > 0 ? (
            <Button
              type='button'
              variant='outline'
              size='sm'
              disabled={disabled}
              onClick={() => setStep((current) => current - 1)}
            >
              <ChevronLeft className='size-3.5' />
              上一步
            </Button>
          ) : null}
          <Button type='button' size='sm' disabled={disabled} onClick={goNext}>
            {step < params.length - 1 ? (
              <>
                下一步
                <ChevronRight className='size-3.5' />
              </>
            ) : (
              <>
                <Send className='size-3.5' />
                提交并继续
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

function StepperProgress({ step, total }: { step: number; total: number }) {
  return (
    <div className='flex items-center justify-between gap-4'>
      <div className='text-xs font-medium text-muted-foreground'>
        需求确认
        {total > 1 ? ` · Step ${step + 1}/${total}` : ''}
      </div>
      {total > 1 ? (
        <div
          className='flex w-20 items-center gap-1'
          aria-label={`第 ${step + 1} 步，共 ${total} 步`}
        >
          {Array.from({ length: total }, (_, index) => (
            <span
              key={index}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors',
                index <= step ? 'bg-primary' : 'bg-muted'
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function isChoiceParam(param: PowerParam) {
  return param.type === 'option' || param.type === 'multi_option'
}

function hasInteractionValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.length > 0
  }
  return value != null && String(value).trim() !== ''
}
