// Parses STEP/IGES off the main thread so a heavy file cannot freeze the page.
import init from 'occt-import-js'
import wasmUrl from 'occt-import-js/dist/occt-import-js.wasm?url'
import { READER_LOAD_FAILED, postResult, runParse, type ParseRequest, type ParseResponse } from '../lib/workerProtocol'

const ctx = self as unknown as {
  onmessage: ((e: { data: ParseRequest }) => void) | null
  postMessage(message: unknown, transfer: Transferable[]): void
}

// Start loading right away; { ready: true } tells the page the wasm is up, so its parse timer excludes the download.
// the wasm is served from our own origin
const occtPromise = init({ locateFile: () => wasmUrl }).then((occt) => {
  ctx.postMessage({ ready: true }, [])
  return occt
})
occtPromise.catch(() => {}) // reported when a request arrives

ctx.onmessage = async (e) => {
  let response: ParseResponse
  try {
    response = runParse(e.data, await occtPromise)
  } catch (err) {
    console.error(err)
    response = { ok: false, error: READER_LOAD_FAILED }
  }
  postResult((msg, transfer) => ctx.postMessage(msg, transfer), response)
}
