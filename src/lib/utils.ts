import { type ClassValue, clsx } from 'clsx'
import { format as formatDate, parseISO } from 'date-fns'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function sleep(ms: number = 1000) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Generates page numbers for pagination with ellipsis
 * @param currentPage - Current page number (1-based)
 * @param totalPages - Total number of pages
 * @returns Array of page numbers and ellipsis strings
 *
 * Examples:
 * - Small dataset (≤5 pages): [1, 2, 3, 4, 5]
 * - Near beginning: [1, 2, 3, 4, '...', 10]
 * - In middle: [1, '...', 4, 5, 6, '...', 10]
 * - Near end: [1, '...', 7, 8, 9, 10]
 */
export function getPageNumbers(currentPage: number, totalPages: number) {
  const maxVisiblePages = 5 // Maximum number of page buttons to show
  const rangeWithDots = []

  if (totalPages <= maxVisiblePages) {
    // If total pages is 5 or less, show all pages
    for (let i = 1; i <= totalPages; i++) {
      rangeWithDots.push(i)
    }
  } else {
    // Always show first page
    rangeWithDots.push(1)

    if (currentPage <= 3) {
      // Near the beginning: [1] [2] [3] [4] ... [10]
      for (let i = 2; i <= 4; i++) {
        rangeWithDots.push(i)
      }
      rangeWithDots.push('...', totalPages)
    } else if (currentPage >= totalPages - 2) {
      // Near the end: [1] ... [7] [8] [9] [10]
      rangeWithDots.push('...')
      for (let i = totalPages - 3; i <= totalPages; i++) {
        rangeWithDots.push(i)
      }
    } else {
      // In the middle: [1] ... [4] [5] [6] ... [10]
      rangeWithDots.push('...')
      for (let i = currentPage - 1; i <= currentPage + 1; i++) {
        rangeWithDots.push(i)
      }
      rangeWithDots.push('...', totalPages)
    }
  }

  return rangeWithDots
}

export function formatDisplayValue(value: unknown, formatType?: string) {
  const normalizedFormat = String(formatType || '').trim().toLowerCase()
  if (normalizedFormat === 'duration-ms') {
    return formatDurationMilliseconds(value)
  }

  if (value == null) {
    return ''
  }

  const text = String(value).trim()
  if (!text) {
    return ''
  }

  if (normalizedFormat === 'number') {
    const number = Number(text)
    return Number.isFinite(number)
      ? new Intl.NumberFormat('zh-CN').format(number)
      : text
  }

  if (
    normalizedFormat === 'date' ||
    normalizedFormat === 'datetime' ||
    normalizedFormat === 'datetime-minute' ||
    normalizedFormat === 'datetime-second'
  ) {
    const parsed = parseDisplayDateValue(text)
    if (!Number.isNaN(parsed.getTime())) {
      switch (normalizedFormat) {
        case 'date':
          return formatDate(parsed, 'yyyy-MM-dd')
        case 'datetime-minute':
          return formatDate(parsed, 'yyyy-MM-dd HH:mm')
        case 'datetime':
        case 'datetime-second':
          return formatDate(parsed, 'yyyy-MM-dd HH:mm:ss')
      }
    }
  }

  return text
}

function formatDurationMilliseconds(value: unknown) {
  if (value == null) {
    return '-'
  }

  const text = String(value).trim()
  if (!text) {
    return '-'
  }

  const milliseconds = Number(text)
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
    return '-'
  }

  const seconds = milliseconds / 1000
  const fractionDigits = seconds < 1 ? 2 : seconds < 10 ? 1 : 0
  return `${Number(seconds.toFixed(fractionDigits)).toLocaleString('zh-CN')}s`
}

function parseDisplayDateValue(text: string) {
  const normalized = normalizeDateTimeText(text)

  try {
    return parseISO(normalized)
  } catch {
    return new Date(normalized)
  }
}

function normalizeDateTimeText(text: string) {
  const current = String(text || '').trim()
  if (!current) {
    return ''
  }

  return current.replace(
    /\.(\d+)(Z|[+-]\d{2}:\d{2})$/,
    (_, fraction: string, suffix: string) => `.${fraction.slice(0, 3)}${suffix}`
  )
}
