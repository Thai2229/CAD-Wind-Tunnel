import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CAD_PARSE_TIMEOUT_MS,
  CAD_STARTUP_TIMEOUT_MS,
  WorkerCallError,
  callWorker,
  describeCadError,
  type WorkerLike,
} from './workerClient'
import { READER_LOAD_FAILED } from './workerProtocol'

function fakeWorker() {
  const w = {
    postMessage: vi.fn(),
    terminate: vi.fn(),
    onmessage: null,
    onerror: null,
  } as WorkerLike & { postMessage: ReturnType<typeof vi.fn>; terminate: ReturnType<typeof vi.fn> }
  return w
}

describe('callWorker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('has a 60 second default timeout', () => {
    expect(CAD_PARSE_TIMEOUT_MS).toBe(60_000)
  })

  it('posts the request with the transfer list', () => {
    const w = fakeWorker()
    const buf = new ArrayBuffer(4)
    const p = callWorker(w, { a: 1 }, { transfer: [buf] })
    p.catch(() => {})
    expect(w.postMessage).toHaveBeenCalledTimes(1)
    expect(w.postMessage).toHaveBeenCalledWith({ a: 1 }, [buf])
  })

  it('resolves with result on { ok: true }, terminates once and clears the timer', async () => {
    const w = fakeWorker()
    const p = callWorker<{ a: number }, string>(w, { a: 1 })
    w.onmessage!({ data: { ok: true, result: 'done' } })
    await expect(p).resolves.toBe('done')
    expect(w.terminate).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('rejects with the error message on { ok: false }', async () => {
    const w = fakeWorker()
    const p = callWorker(w, {})
    const assertion = expect(p).rejects.toThrow('bad file')
    w.onmessage!({ data: { ok: false, error: 'bad file' } })
    await assertion
    expect(w.terminate).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('rejects with a timeout error and terminates when no reply arrives', async () => {
    const w = fakeWorker()
    const p = callWorker(w, {}, { timeoutMs: 1000 })
    w.onmessage!({ data: { ready: true } })
    const assertion = expect(p).rejects.toThrow(/too long|timed out/i)
    await vi.advanceTimersByTimeAsync(999)
    expect(w.terminate).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    await assertion
    expect(w.terminate).toHaveBeenCalledTimes(1)
  })

  it('uses CAD_PARSE_TIMEOUT_MS by default', async () => {
    const w = fakeWorker()
    const p = callWorker(w, {})
    w.onmessage!({ data: { ready: true } })
    const assertion = expect(p).rejects.toThrow(/too long|timed out/i)
    await vi.advanceTimersByTimeAsync(CAD_PARSE_TIMEOUT_MS - 1)
    expect(w.terminate).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    await assertion
    expect(w.terminate).toHaveBeenCalledTimes(1)
  })

  it('rejects with a worker error when onerror fires, terminates once, clears timer', async () => {
    const w = fakeWorker()
    const p = callWorker(w, {})
    const assertion = expect(p).rejects.toThrow(/worker/i)
    w.onerror!({ message: 'boom' })
    await assertion
    expect(w.terminate).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('rejects with a worker error when onerror has no message', async () => {
    const w = fakeWorker()
    const p = callWorker(w, {})
    const assertion = expect(p).rejects.toThrow(/worker/i)
    w.onerror!({})
    await assertion
  })

  it('ignores late messages and errors after settling', async () => {
    const w = fakeWorker()
    const p = callWorker<object, string>(w, {})
    w.onmessage!({ data: { ok: true, result: 'first' } })
    w.onmessage!({ data: { ok: true, result: 'second' } })
    w.onmessage!({ data: { ok: false, error: 'late' } })
    w.onerror?.({ message: 'late' })
    await expect(p).resolves.toBe('first')
    expect(w.terminate).toHaveBeenCalledTimes(1)
  })

  it('ignores a message arriving after the timeout', async () => {
    const w = fakeWorker()
    const p = callWorker(w, {}, { timeoutMs: 10 })
    w.onmessage!({ data: { ready: true } })
    const assertion = expect(p).rejects.toThrow(/too long|timed out/i)
    await vi.advanceTimersByTimeAsync(10)
    await assertion
    w.onmessage?.({ data: { ok: true, result: 'late' } })
    expect(w.terminate).toHaveBeenCalledTimes(1)
  })
})

const ready = { data: { ready: true } }

describe('callWorker cancellation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('rejects with kind aborted, terminates once and clears timers when the signal aborts', async () => {
    const w = fakeWorker()
    const ac = new AbortController()
    const p = callWorker(w, {}, { signal: ac.signal })
    const assertion = expect(p).rejects.toMatchObject({ kind: 'aborted' })
    ac.abort()
    await assertion
    await expect(p).rejects.toBeInstanceOf(WorkerCallError)
    expect(w.terminate).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('aborts after ready too (parse phase timer cleared)', async () => {
    const w = fakeWorker()
    const ac = new AbortController()
    const p = callWorker(w, {}, { signal: ac.signal })
    w.onmessage!(ready)
    const assertion = expect(p).rejects.toMatchObject({ kind: 'aborted' })
    ac.abort()
    await assertion
    expect(w.terminate).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('rejects without posting when already aborted', async () => {
    const w = fakeWorker()
    const ac = new AbortController()
    ac.abort()
    const p = callWorker(w, {}, { signal: ac.signal })
    await expect(p).rejects.toMatchObject({ kind: 'aborted' })
    expect(w.postMessage).not.toHaveBeenCalled()
    expect(w.terminate).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('abort after settling is a no-op', async () => {
    const w = fakeWorker()
    const ac = new AbortController()
    const p = callWorker<object, string>(w, {}, { signal: ac.signal })
    w.onmessage!({ data: { ok: true, result: 'done' } })
    await expect(p).resolves.toBe('done')
    ac.abort()
    expect(w.terminate).toHaveBeenCalledTimes(1)
  })
})

describe('callWorker messageerror', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('rejects with kind worker, terminates once and clears timers', async () => {
    const w = fakeWorker()
    const p = callWorker(w, {})
    const assertion = expect(p).rejects.toMatchObject({ kind: 'worker', message: expect.stringMatching(/worker/i) })
    w.onmessageerror!({})
    await assertion
    expect(w.terminate).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('callWorker ready handshake', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('exports a 30 second startup timeout', () => {
    expect(CAD_STARTUP_TIMEOUT_MS).toBe(30_000)
  })

  it('succeeds when ready at 20 s and the reply comes 50 s after ready', async () => {
    const w = fakeWorker()
    const p = callWorker<object, string>(w, {})
    await vi.advanceTimersByTimeAsync(20_000)
    w.onmessage!(ready)
    await vi.advanceTimersByTimeAsync(50_000)
    w.onmessage!({ data: { ok: true, result: 'slow' } })
    await expect(p).resolves.toBe('slow')
    expect(w.terminate).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('times out 60 s after ready, not 60 s after the call', async () => {
    const w = fakeWorker()
    const p = callWorker(w, {})
    const assertion = expect(p).rejects.toMatchObject({ kind: 'timeout' })
    await vi.advanceTimersByTimeAsync(20_000)
    w.onmessage!(ready)
    await vi.advanceTimersByTimeAsync(59_999)
    expect(w.terminate).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    await assertion
    expect(w.terminate).toHaveBeenCalledTimes(1)
  })

  it('rejects with kind startup and terminates when no ready arrives within 30 s', async () => {
    const w = fakeWorker()
    const p = callWorker(w, {})
    const assertion = expect(p).rejects.toMatchObject({
      kind: 'startup',
      message: expect.stringMatching(/could not load|start/i),
    })
    await vi.advanceTimersByTimeAsync(CAD_STARTUP_TIMEOUT_MS - 1)
    expect(w.terminate).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    await assertion
    expect(w.terminate).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not fire the startup timeout after ready', async () => {
    const w = fakeWorker()
    const p = callWorker(w, {}, { timeoutMs: 100_000 })
    p.catch(() => {})
    await vi.advanceTimersByTimeAsync(10_000)
    w.onmessage!(ready)
    await vi.advanceTimersByTimeAsync(40_000)
    expect(w.terminate).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(1)
  })

  it('still accepts a reply that arrives before any ready message', async () => {
    const w = fakeWorker()
    const p = callWorker<object, string>(w, {})
    w.onmessage!({ data: { ok: true, result: 'old worker' } })
    await expect(p).resolves.toBe('old worker')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('never treats the ready message as the result and ignores a duplicate ready', async () => {
    const w = fakeWorker()
    let settled = false
    const p = callWorker<object, string>(w, {})
    p.then(
      () => {
        settled = true
      },
      () => {
        settled = true
      },
    )
    w.onmessage!(ready)
    w.onmessage!(ready)
    await vi.advanceTimersByTimeAsync(0)
    expect(settled).toBe(false)
    expect(w.terminate).not.toHaveBeenCalled()
    w.onmessage!({ data: { ok: true, result: 'real' } })
    await expect(p).resolves.toBe('real')
  })
})

describe('describeCadError', () => {
  it('maps timeout', () => {
    expect(describeCadError(new WorkerCallError('x', 'timeout'))).toMatch(/took too long/i)
  })

  it('maps startup', () => {
    expect(describeCadError(new WorkerCallError('x', 'startup'))).toMatch(/could not load the STEP\/IGES reader/i)
  })

  it('maps worker crashes to a model hint, not a connection hint', () => {
    const msg = describeCadError(new WorkerCallError('Worker error: boom', 'worker'))
    expect(msg).toMatch(/crashed|ran out of memory|too (complex|large)|simpler/i)
    expect(msg).not.toMatch(/check your connection/i)
  })

  it('returns an empty string for aborted', () => {
    expect(describeCadError(new WorkerCallError('x', 'aborted'))).toBe('')
  })

  it('keeps reply messages unchanged, with and without limit', () => {
    expect(describeCadError(new WorkerCallError('Too complex, simplify', 'reply', true))).toBe('Too complex, simplify')
    expect(describeCadError(new WorkerCallError('Could not read this STEP file. bad', 'reply'))).toBe(
      'Could not read this STEP file. bad',
    )
  })

  it('maps READER_LOAD_FAILED replies to the reader load message', () => {
    expect(describeCadError(new WorkerCallError(READER_LOAD_FAILED, 'reply'))).toMatch(
      /could not load the STEP\/IGES reader/i,
    )
  })

  it.each([new Error('boom'), 'str', null, undefined, 42])('maps unknown error %s to a generic message', (e) => {
    expect(describeCadError(e)).toMatch(/could not read/i)
  })
})
