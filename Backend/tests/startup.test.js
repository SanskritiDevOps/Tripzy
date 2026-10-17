import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const backendDir = fileURLToPath(new URL('..', import.meta.url))

describe('startup', () => {
  // Vitest's module loader turns a missing named import into `undefined`; plain Node
  // (what the server runs on) refuses to start. Load the app the way production does.
  it('loads every module in plain Node without import errors', () => {
    const result = spawnSync(
      process.execPath,
      ['--experimental-strip-types', '--disable-warning=ExperimentalWarning', '--input-type=module', '-e', "await import('./src/app.js'); await import('./src/realtime/socket.js')"],
      { cwd: backendDir, env: process.env, encoding: 'utf8', timeout: 30_000 },
    )
    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
  })
})
