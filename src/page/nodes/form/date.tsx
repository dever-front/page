import { format } from 'date-fns'
import { Calendar as CalendarIcon, Clock3 } from 'lucide-react'
import { useMemo } from 'react'
import type { DateRange } from 'react-day-picker'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useStorePathValue } from '@/lib/store'
import { cn } from '@/lib/utils'
import type { NodeItemProps } from '../../nodes'

export function FormDate({ item, value, setValue, error, store }: NodeItemProps) {
  const inputType = normalizeDateInputType(item.meta?.inputType || item.meta?.picker)
  const rangeMode = item.meta?.range === true
  const endValuePath = rangeMode
    ? String(item.meta?.endValue || item.meta?.endPath || '').trim()
    : ''
  const endRawValue = useStorePathValue(store, endValuePath)

  const startDate = useMemo(
    () => parseDateValue(String(value || '').trim(), inputType),
    [inputType, value]
  )
  const endDate = useMemo(
    () => parseDateValue(String(endRawValue || '').trim(), inputType),
    [endRawValue, inputType]
  )

  const displayText = rangeMode
    ? formatRangeDisplayText(startDate, endDate, inputType, item.placeholder)
    : formatSingleDisplayText(startDate, inputType, item.placeholder)

  const setEndValue = (nextValue: string) => {
    if (!endValuePath) {
      return
    }
    store.getState().setValueByPath(endValuePath, nextValue)
  }

  const commitSingleDate = (date: Date | undefined) => {
    if (!date) {
      setValue('')
      return
    }

    if (inputType === 'datetime-local') {
      const nextDate = mergeDateWithTime(date, startDate, 'start')
      setValue(formatLocalDateTime(nextDate))
      return
    }

    setValue(formatLocalDate(date))
  }

  const commitSingleTime = (nextTime: string) => {
    if (inputType !== 'datetime-local') {
      return
    }

    const baseDate = startDate ?? new Date()
    const nextDate = applyTimeToDate(baseDate, nextTime)
    setValue(formatLocalDateTime(nextDate))
  }

  const commitRange = (nextRange: DateRange | undefined) => {
    if (!nextRange?.from && !nextRange?.to) {
      setValue('')
      setEndValue('')
      return
    }

    if (nextRange?.from) {
      if (inputType === 'datetime-local') {
        setValue(formatLocalDateTime(mergeDateWithTime(nextRange.from, startDate, 'start')))
      } else {
        setValue(formatLocalDate(nextRange.from))
      }
    }

    if (nextRange?.to) {
      if (inputType === 'datetime-local') {
        setEndValue(formatLocalDateTime(mergeDateWithTime(nextRange.to, endDate, 'end')))
      } else {
        setEndValue(formatLocalDate(nextRange.to))
      }
    } else {
      setEndValue('')
    }
  }

  const commitRangeTime = (boundary: 'start' | 'end', nextTime: string) => {
    if (inputType !== 'datetime-local') {
      return
    }

    const baseDate = boundary === 'start' ? startDate : endDate
    if (!baseDate) {
      return
    }

    const nextDate = applyTimeToDate(baseDate, nextTime)
    if (boundary === 'start') {
      setValue(formatLocalDateTime(nextDate))
      return
    }
    setEndValue(formatLocalDateTime(nextDate))
  }

  const rangeValue = rangeMode
    ? ({
        from: startDate,
        to: endDate,
      } satisfies DateRange)
    : undefined

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='outline'
          data-empty={!startDate && !endDate}
          className={cn(
            'w-full justify-between text-left font-normal data-[empty=true]:text-muted-foreground',
            error && 'border-destructive ring-destructive/20 focus-visible:ring-destructive/30'
          )}
        >
          <span className='truncate'>{displayText}</span>
          <CalendarIcon className='size-4 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-auto p-0' align='start'>
        <div className='space-y-3 p-3'>
          <Calendar
            mode={rangeMode ? 'range' : 'single'}
            numberOfMonths={rangeMode ? 2 : 1}
            captionLayout='dropdown'
            selected={rangeMode ? rangeValue : startDate}
            onSelect={(selected) => {
              if (rangeMode) {
                commitRange(selected as DateRange | undefined)
                return
              }
              commitSingleDate(selected as Date | undefined)
            }}
          />
          {inputType === 'datetime-local' ? (
            rangeMode ? (
              <div className='grid gap-3 border-t pt-3 sm:grid-cols-2'>
                <TimeField
                  label='开始时间'
                  value={startDate ? format(startDate, 'HH:mm') : ''}
                  disabled={!startDate}
                  onChange={(nextTime) => commitRangeTime('start', nextTime)}
                />
                <TimeField
                  label='结束时间'
                  value={endDate ? format(endDate, 'HH:mm') : ''}
                  disabled={!endDate}
                  onChange={(nextTime) => commitRangeTime('end', nextTime)}
                />
              </div>
            ) : (
              <div className='flex items-center gap-2 border-t pt-3'>
                <Clock3 className='size-4 shrink-0 text-muted-foreground' />
                <Input
                  type='time'
                  step='60'
                  value={startDate ? format(startDate, 'HH:mm') : ''}
                  onChange={(event) => commitSingleTime(event.target.value)}
                  className='h-8 w-[140px]'
                />
              </div>
            )
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function TimeField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: string
  disabled?: boolean
  onChange: (value: string) => void
}) {
  return (
    <div className='space-y-1.5'>
      <div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
        <Clock3 className='size-3.5 shrink-0' />
        <span>{label}</span>
      </div>
      <Input
        type='time'
        step='60'
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className='h-8'
      />
    </div>
  )
}

function normalizeDateInputType(value: unknown): 'date' | 'datetime-local' {
  const current = String(value || '').trim().toLowerCase()
  return current === 'datetime' || current === 'datetime-local' ? 'datetime-local' : 'date'
}

function parseDateValue(value: string, inputType: 'date' | 'datetime-local') {
  if (!value) {
    return undefined
  }

  const normalized = value.replace('T', ' ').trim()
  const [datePart, timePart = ''] = normalized.split(' ')
  const [yearText, monthText, dayText] = datePart.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return undefined
  }

  const nextDate = new Date(year, month - 1, day)
  if (inputType === 'datetime-local' && timePart) {
    const [hourText, minuteText] = timePart.split(':')
    nextDate.setHours(Number(hourText || 0), Number(minuteText || 0), 0, 0)
  } else {
    nextDate.setHours(0, 0, 0, 0)
  }
  return nextDate
}

function mergeDateWithTime(
  date: Date,
  source: Date | undefined,
  boundary: 'start' | 'end'
) {
  const nextDate = new Date(date)
  const defaultHours = boundary === 'start' ? 0 : 23
  const defaultMinutes = boundary === 'start' ? 0 : 59
  nextDate.setHours(
    source ? source.getHours() : defaultHours,
    source ? source.getMinutes() : defaultMinutes,
    0,
    0
  )
  return nextDate
}

function applyTimeToDate(date: Date, timeValue: string) {
  const nextDate = new Date(date)
  const [hoursText, minutesText] = timeValue.split(':')
  nextDate.setHours(Number(hoursText || 0), Number(minutesText || 0), 0, 0)
  return nextDate
}

function padDatePart(value: number) {
  return String(value).padStart(2, '0')
}

function formatLocalDate(date: Date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`
}

function formatLocalDateTime(date: Date) {
  return `${formatLocalDate(date)}T${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`
}

function formatSingleDisplayText(
  value: Date | undefined,
  inputType: 'date' | 'datetime-local',
  placeholder?: string
) {
  if (!value) {
    return placeholder || '请选择日期'
  }

  return format(value, inputType === 'datetime-local' ? 'yyyy-MM-dd HH:mm' : 'yyyy-MM-dd')
}

function formatRangeDisplayText(
  start: Date | undefined,
  end: Date | undefined,
  inputType: 'date' | 'datetime-local',
  placeholder?: string
) {
  const fallback = placeholder || '请选择时间范围'
  if (!start && !end) {
    return fallback
  }

  const dateFormat = inputType === 'datetime-local' ? 'yyyy-MM-dd HH:mm' : 'yyyy-MM-dd'
  const startText = start ? format(start, dateFormat) : '开始'
  const endText = end ? format(end, dateFormat) : '结束'
  return `${startText} ~ ${endText}`
}
