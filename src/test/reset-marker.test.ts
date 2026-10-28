import { describe, expect, it } from 'vitest'
import { mustWipe } from '@/lib/resetMarker'

describe('mustWipe', () => {
  const AT = '2026-10-28T03:14:04.994Z'

  it('does nothing when the store was never cleared', () => {
    expect(mustWipe(null, null, false)).toBe(false)
    expect(mustWipe(undefined, null, false)).toBe(false)
  })

  it('wipes a terminal that has not seen this clear', () => {
    expect(mustWipe(AT, null, false)).toBe(true)
    expect(mustWipe(AT, '2026-01-01T00:00:00.000Z', false)).toBe(true)
  })

  it('leaves a terminal that already wiped for it', () => {
    expect(mustWipe(AT, AT, false)).toBe(false)
  })

  it('never wipes a pull from nothing — there is nothing stale yet', () => {
    expect(mustWipe(AT, null, true)).toBe(false)
  })
})
