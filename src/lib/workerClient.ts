import { READER_LOAD_FAILED } from './workerProtocol'

export const CAD_PARSE_TIMEOUT_MS = 60_000
export const CAD_STARTUP_TIMEOUT_MS = 30_000

export interface WorkerLike {
  postMessage(message: unknown, transfer?: Transferable[]): void
  terminate(): void
  onmessage: ((e: { data: unknown }) => void) | null
  onerror: ((e: { message?: string }) => void) | null
  onmessageerror?: ((e: unknown) => void) | null
}

export type WorkerCallErrorKind = 'reply' | 'worker' | 'timeout' | 'aborted' | 'startup'

// kind tells the caller why it failed: the worker replied with an error, crashed or failed to start, or timed out.
export class WorkerCallError extends Error {
  kind: WorkerCallErrorKind
  limit: boolean
  constructor(message: string, kind: WorkerCallErrorKind, limit = false) {
    super(message)
    this.kind = kind
    this.limit = limit
  }
}

// One request, one reply. The worker is always terminated afterwards; the caller makes a fresh one per call.
// Two timers: startup runs until the worker posts { ready: true } (wasm initialised), then the parse timer starts.
export function callWorker<TReq, TRes>(
  worker: WorkerLike,
  request: TReq,
  options?: { timeoutMs?: number; transfer?: Transferable[]; signal?: AbortSignal },
): Promise<TRes> {
  return new Promise<TRes>((resolve, reject) => {
    const signal = options?.signal
    let settled = false
    let ready = false
    let startupTimer: ReturnType<typeof setTimeout> | undefined
    let parseTimer: ReturnType<typeof setTimeout> | undefined
    const onAbort = () => {
      settle(() => reject(new WorkerCallError('Cancelled.', 'aborted')))
    }
    const settle = (finish: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(startupTimer)
      clearTimeout(parseTimer)
      signal?.removeEventListener('abort', onAbort)
      worker.terminate()
      finish()
    }
    if (signal?.aborted) {
      onAbort()
      return
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    worker.onmessage = (e) => {
      const data = e.data as { ready?: boolean; ok?: boolean; result?: TRes; error?: string; limit?: boolean } | null
      if (!data) return
      if (data.ready === true) {
        if (ready || settled) return
        ready = true
        clearTimeout(startupTimer)
        parseTimer = setTimeout(() => {
          settle(() => reject(new WorkerCallError('Reading this CAD file took too long. Try a simpler model.', 'timeout')))
        }, options?.timeoutMs ?? CAD_PARSE_TIMEOUT_MS)
        return
      }
      if (data.ok) {
        settle(() => resolve(data.result as TRes))
      } else {
        settle(() => reject(new WorkerCallError(data.error ?? 'Unknown worker error', 'reply', data.limit === true)))
      }
    }
    worker.onerror = (e) => {
      settle(() => reject(new WorkerCallError(`Worker error: ${e.message ?? 'unknown'}`, 'worker')))
    }
    worker.onmessageerror = () => {
      settle(() => reject(new WorkerCallError('Worker error: could not read its reply', 'worker')))
    }
    startupTimer = setTimeout(() => {
      settle(() => reject(new WorkerCallError('The CAD reader did not start in time.', 'startup')))
    }, CAD_STARTUP_TIMEOUT_MS)
    try {
      worker.postMessage(request, options?.transfer)
    } catch (e) {
      let detail = 'unknown'
      if (e instanceof Error) detail = e.message
      settle(() => reject(new WorkerCallError(`Worker error: ${detail}`, 'worker')))
    }
  })
}

const READER_MESSAGE = 'Could not load the STEP/IGES reader. Check your connection and try again.'

// User-facing text for a failed CAD parse; '' means cancelled, show nothing.
export function describeCadError(error: unknown): string {
  if (!(error instanceof WorkerCallError)) return 'Could not read this CAD file.'
  if (error.kind === 'aborted') return ''
  if (error.kind === 'timeout') return 'Reading this CAD file took too long. Try a simpler model.'
  if (error.kind === 'startup') return READER_MESSAGE
  if (error.kind === 'worker') {
    return 'The CAD reader crashed, possibly because the model is too complex or ran out of memory. Try a simpler model.'
  }
  if (error.message === READER_LOAD_FAILED) return READER_MESSAGE
  return error.message
}
