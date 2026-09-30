import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const env = { ...process.env }
if ((env.HTTPS_PROXY || env.https_proxy) && !('NODE_USE_ENV_PROXY' in env)) {
  env.NODE_USE_ENV_PROXY = '1'
}

const watch = process.argv.includes('--watch') ? ['--watch'] : []
const child = spawn(process.execPath, [...watch, 'index.js'], {
  cwd: dirname(fileURLToPath(import.meta.url)), env, stdio: 'inherit',
})

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
child.on('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0) })
