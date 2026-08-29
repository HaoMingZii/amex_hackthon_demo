const KEY = 'amex_pushed'

export function loadPushed(): string[] {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function markPushed(id: string) {
  const next = Array.from(new Set([...loadPushed(), id]))
  sessionStorage.setItem(KEY, JSON.stringify(next))
  return next
}
