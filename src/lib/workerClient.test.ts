import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CAD_PARSE_TIMEOUT_MS, callWorker, type WorkerLike } from './workerClient'

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
    const assertion = expect(p).rejects.toThrow(/too long|timed out/i)
    await vi.advanceTimersByTimeAsync(10)
    await assertion
    w.onmessage?.({ data: { ok: true, result: 'late' } })
    expect(w.terminate).toHaveBeenCalledTimes(1)
  })
})
