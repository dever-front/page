/**
 * Cookie utility functions using manual document.cookie approach
 * Replaces js-cookie dependency for better consistency
 */

const DEFAULT_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

/**
 * Get a cookie value by name
 */
export function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined

  for (const currentName of cookieNameVariants(name)) {
    const cookieValue = readCookieValue(currentName)
    if (cookieValue != null) {
      return decodeCookieValue(cookieValue)
    }
  }
  return undefined
}

/**
 * Set a cookie with name, value, and optional max age
 */
export function setCookie(
  name: string,
  value: string,
  maxAge: number = DEFAULT_MAX_AGE
): void {
  if (typeof document === 'undefined') return

  document.cookie = serializeCookie(
    encodeURIComponent(name),
    encodeURIComponent(value),
    maxAge
  )
}

/**
 * Remove a cookie by setting its max age to 0
 */
export function removeCookie(name: string): void {
  if (typeof document === 'undefined') return

  cookieNameVariants(name).forEach((currentName) => {
    document.cookie = serializeCookie(currentName, '', 0)
  })
}

function readCookieValue(name: string) {
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length !== 2) {
    return undefined
  }
  return parts.pop()?.split(';').shift()
}

function cookieNameVariants(name: string) {
  const encodedName = encodeURIComponent(name)
  return encodedName === name ? [name] : [encodedName, name]
}

function decodeCookieValue(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function serializeCookie(name: string, value: string, maxAge: number) {
  const parts = [
    `${name}=${value}`,
    'path=/',
    `max-age=${maxAge}`,
    'SameSite=Lax',
  ]
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    parts.push('Secure')
  }
  return parts.join('; ')
}
