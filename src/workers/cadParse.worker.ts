// Parses STEP/IGES off the main thread so a heavy file cannot freeze the page.
import init from 'occt-import-js'
import wasmUrl from 'occt-import-js/dist/occt-import-js.wasm?url'
import { READER_LOAD_FAILED, runParse, type ParseRequest, type ParseResponse } from '../lib/workerProtocol'

const ctx = self as unknown as {
  onmessage: ((e: { data: ParseRequest }) => void) | null
  postMessage(message: ParseResponse, transfer: Transferable[]): void
}

ctx.onmessage = async (e) => {
  let response: ParseResponse
  try {
    // the wasm is served from our own origin
    const occt = await init({ locateFile: () => wasmUrl })
    response = runParse(e.data, occt)
  } catch (err) {
    console.error(err)
    response = { ok: false, error: READER_LOAD_FAILED }
  }
  const transfer: Transferable[] = []
  if (response.ok) {
    for (const m of response.result) {
      transfer.push(m.positions.buffer as ArrayBuffer, m.indices.buffer as ArrayBuffer)
      if (m.normals) transfer.push(m.normals.buffer as ArrayBuffer)
    }
  }
  ctx.postMessage(response, transfer)
}
