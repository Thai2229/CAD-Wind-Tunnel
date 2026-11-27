export const CAD_PARSE_TIMEOUT_MS = 60_000

export interface WorkerLike {
  postMessage(message: unknown, transfer?: Transferable[]): void
  terminate(): void
  onmessage: ((e: { data: unknown }) => void) | null
  onerror: ((e: { message?: string }) => void) | null
}

// kind tells the caller why it failed: the worker replied with an error, crashed or failed to start, or timed out.
export class WorkerCallError extends Error {
  kind: 'reply' | 'worker' | 'timeout'
  limit: boolean
  constructor(message: string, kind: 'reply' | 'worker' | 'timeout', limit = false) {
    super(message)
    this.kind = kind
    this.limit = limit
  }
}

// One request, one reply. The worker is always terminated afterwards; the caller makes a fresh one per call.
export function callWorker<TReq, TRes>(
  worker: WorkerLike,
  request: TReq,
  options?: { timeoutMs?: number; transfer?: Transferable[] },
): Promise<TRes> {
  return new Promise<TRes>((resolve, reject) => {
    let settled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const settle = (finish: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      worker.terminate()
      finish()
    }
    worker.onmessage = (e) => {
      const data = e.data as { ok: boolean; result?: TRes; error?: string; limit?: boolean }
      if (data.ok) {
        settle(() => resolve(data.result as TRes))
      } else {
        settle(() => reject(new WorkerCallError(data.error ?? 'Unknown worker error', 'reply', data.limit === true)))
      }
    }
    worker.onerror = (e) => {
      settle(() => reject(new WorkerCallError(`Worker error: ${e.message ?? 'unknown'}`, 'worker')))
    }
    timer = setTimeout(() => {
      settle(() => reject(new WorkerCallError('Reading this CAD file took too long. Try a simpler model.', 'timeout')))
    }, options?.timeoutMs ?? CAD_PARSE_TIMEOUT_MS)
    try {
      worker.postMessage(request, options?.transfer)
    } catch (e) {
      let detail = 'unknown'
      if (e instanceof Error) detail = e.message
      settle(() => reject(new WorkerCallError(`Worker error: ${detail}`, 'worker')))
    }
  })
}
