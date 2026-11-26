declare module 'occt-import-js' {
  import type { OcctResult } from './lib/occtMesh'
  type Occt = {
    ReadStepFile(content: Uint8Array, params: null): OcctResult
    ReadIgesFile(content: Uint8Array, params: null): OcctResult
  }
  const init: (options?: { locateFile?: (name: string) => string }) => Promise<Occt>
  export default init
}
