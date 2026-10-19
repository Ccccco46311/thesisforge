// ============================================================
// ThesisForge bridge - OpenCode 托管模块
// 负责：
//   1. 拉起并管理独立的 opencode serve 进程（项目内嵌二进制）
//   2. Basic Auth HTTP 客户端（访问 serve 的 /api/*）
//   3. session 创建 / 列表 / 发消息 / 读消息 / 删除
//
// 隔离设计：
//   - OPENCODE_DB             → 项目内 data/opencode/opencode.db（独立库）
//   - OPENCODE_SERVER_PASSWORD→ 生成的随机密码（Basic Auth）
//   - OPENCODE_CONFIG_CONTENT → 注入数据库里的供应商配置
//   - 创建 session 显式传 location = 项目目录，列表按目录过滤
// ============================================================
import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { buildAgentsConfig } from './agents.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// bridge/src 的上上级目录即项目根
export const PROJECT_ROOT = path.resolve(__dirname, '..', '..')

// serve 监听端口（固定，可用环境变量覆盖）
export const SERVE_PORT = Number(process.env.OPENCODE_SERVE_PORT || 4199)
const SERVE_HOST = '127.0.0.1'

// 数据目录（独立数据库、密码、配置都放这里，已在 .gitignore）
const DATA_DIR = path.join(PROJECT_ROOT, 'data', 'opencode')
const DB_PATH = path.join(DATA_DIR, 'opencode.db')
const PASSWORD_FILE = path.join(DATA_DIR, 'server-password')
const PROVIDER_FILE = path.join(DATA_DIR, 'provider.json')

// opencode 二进制：优先项目内嵌，其次全局 PATH
const EMBEDDED_BIN = path.join(
  __dirname,
  '..',
  'node_modules',
  '@opencode',
  'cli',
  'bin',
  'opencode.exe',
)

// ---------- 进程状态 ----------
let serverProcess = null
let serverUrl = null
let starting = null

/**
 * 解析可用的 opencode 可执行文件路径。
 */
export function resolveOpenCodeBin() {
  return EMBEDDED_BIN
}

/**
 * 读取（或生成并持久化）serve 的 Basic Auth 密码。
 * 生成后写入 data/opencode/server-password，重启不变。
 */
async function loadOrCreatePassword() {
  try {
    const pwd = await fs.readFile(PASSWORD_FILE, 'utf8')
    if (pwd.trim()) return pwd.trim()
  } catch {
    // 不存在则生成
  }
  const pwd = crypto.randomBytes(24).toString('base64url')
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(PASSWORD_FILE, pwd, 'utf8')
  return pwd
}

/**
 * 读取供应商配置（provider.json），返回 opencode 原生 provider 配置片段。
 */
async function loadProviderConfig() {
  try {
    return JSON.parse(await fs.readFile(PROVIDER_FILE, 'utf8'))
  } catch {
    return null
  }
}

/**
 * 构造 OPENCODE_CONFIG_CONTENT（opencode 原生配置 JSON 字符串）。
 * 用数据库同步来的供应商配置生成 provider 片段，并注入流水线 agent 定义。
 */
async function buildConfigContent() {
  const p = await loadProviderConfig()
  if (!p) return null
  const providerId = p.provider || 'custom'
  return JSON.stringify({
    provider: {
      [providerId]: {
        npm: '@ai-sdk/openai-compatible',
        name: p.name || providerId,
        options: {
          baseURL: p.baseUrl || '',
          apiKey: p.apiKey || '',
          setCacheKey: true,
        },
        models: p.model ? { [p.model]: { name: p.model } } : {},
      },
    },
    model: p.model ? `${providerId}/${p.model}` : undefined,
    // 流水线 agent：每个阶段一个专属 primary agent（含系统提示词和权限）
    agents: buildAgentsConfig(),
  })
}

/**
 * 启动独立 opencode serve（幂等）。
 * 返回 { url, password }。
 */
export async function ensureServer() {
  if (serverProcess && serverUrl) {
    return { url: serverUrl, password: await loadOrCreatePassword() }
  }
  if (starting) return starting

  starting = (async () => {
    const password = await loadOrCreatePassword()
    const configContent = await buildConfigContent()

    await fs.mkdir(DATA_DIR, { recursive: true })

    const bin = resolveOpenCodeBin()
    const args = [
      'serve',
      `--hostname=${SERVE_HOST}`,
      `--port=${SERVE_PORT}`,
      '--cors',
      'http://localhost:5173',
    ]
    const env = {
      ...process.env,
      OPENCODE_SERVE_PORT: String(SERVE_PORT),
      OPENCODE_DB: DB_PATH,
      OPENCODE_SERVER_PASSWORD: password,
    }
    if (configContent) {
      env.OPENCODE_CONFIG_CONTENT = configContent
    }

    console.log(`[opencode] 启动 serve: ${bin} ${args.join(' ')}`)
    console.log(`[opencode] OPENCODE_DB = ${DB_PATH}`)

    serverProcess = spawn(bin, args, {
      cwd: PROJECT_ROOT,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })

    serverProcess.stdout.on('data', (d) => {
      const line = d.toString().trim()
      if (line) console.log(`[opencode] ${line}`)
    })
    serverProcess.stderr.on('data', (d) => {
      const line = d.toString().trim()
      if (line) console.error(`[opencode:err] ${line}`)
    })
    serverProcess.on('exit', (code, signal) => {
      console.log(`[opencode] serve 进程退出 code=${code} signal=${signal}`)
      serverProcess = null
      serverUrl = null
    })
    serverProcess.on('error', (err) => {
      console.error(`[opencode] serve 进程错误: ${err.message}`)
      serverProcess = null
      serverUrl = null
    })

    // 等待服务就绪
    const url = `http://${SERVE_HOST}:${SERVE_PORT}`
    await waitForServer(url, password, 30000)

    serverUrl = url
    console.log(`[opencode] serve 就绪: ${url}`)
    return { url, password }
  })()

  try {
    return await starting
  } finally {
    starting = null
  }
}

/**
 * 等待服务可用（探测 /api/info）。
 */
async function waitForServer(url, password, timeoutMs) {
  const base = Buffer.from(`opencode:${password}`).toString('base64')
  const deadline = Date.now() + timeoutMs
  let lastErr = null
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${url}/api/info`, {
        headers: { Authorization: `Basic ${base}` },
        signal: AbortSignal.timeout(3000),
      })
      if (r.ok) return
      lastErr = new Error(`HTTP ${r.status}`)
    } catch (e) {
      lastErr = e
    }
    await new Promise((res) => setTimeout(res, 500))
  }
  throw new Error(`OpenCode serve 启动超时: ${lastErr?.message}`)
}

/**
 * 停止 serve 进程，并等待进程退出 + 端口释放。
 */
export async function stopServer() {
  const proc = serverProcess
  serverProcess = null
  serverUrl = null
  if (!proc || proc.exitCode !== null) return

  const exited = new Promise((resolve) => proc.once('exit', resolve))
  try {
    proc.kill()
  } catch {
    // 进程可能已退出
  }
  // 等待进程退出，最多 8 秒
  const timeout = new Promise((resolve) => setTimeout(resolve, 8000))
  await Promise.race([exited, timeout])
  // 等待端口真正释放（轮询探测，最多 10 秒）
  await waitForPortFree(SERVE_PORT, 10000)
}

/**
 * 轮询等待指定端口释放。
 * 只要端口还能连接（无论 HTTP 状态码），就说明还占着；连接失败即视为释放。
 */
async function waitForPortFree(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    let connected = false
    try {
      await fetch(`http://127.0.0.1:${port}/api/info`, {
        signal: AbortSignal.timeout(1500),
      })
      connected = true
    } catch {
      connected = false
    }
    if (!connected) {
      // 连接失败 = 端口已释放
      return
    }
    await new Promise((res) => setTimeout(res, 300))
  }
  // 超时未释放：强杀占用进程
  const pid = await findPortPid(port)
  if (pid) {
    const { execFile } = await import('node:child_process')
    const { promisify } = await import('node:util')
    await promisify(execFile)('taskkill', ['/F', '/PID', String(pid)]).catch(() => {})
  }
}

let lastFoundPid = null
async function findPortPid(port) {
  // 尝试用 netstat 找占用端口的 PID
  const { execFile } = await import('node:child_process')
  const { promisify } = await import('node:util')
  try {
    const { stdout } = await promisify(execFile)('netstat', ['-ano'])
    const line = stdout.split('\n').find((l) => l.includes(`:${port}`) && l.includes('LISTENING'))
    if (line) {
      const pid = line.trim().split(/\s+/).pop()
      lastFoundPid = Number(pid)
      return Number(pid)
    }
  } catch {
    // ignore
  }
  return lastFoundPid
}

/**
 * 保存供应商配置，并刷新 serve 的 provider 注入。
 * @param {object} config { provider, apiKey, baseUrl, model, name }
 */
export async function applyProvider(config) {
  const file = path.join(DATA_DIR, 'provider.json')
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(file, JSON.stringify(config, null, 2), 'utf8')
  // 配置变化需要重启 serve 才能生效（OPENCODE_CONFIG_CONTENT 在进程启动时注入）
  await stopServer()
  await ensureServer()
  return true
}

let cachedAuth = null

async function getAuth() {
  if (cachedAuth) return cachedAuth
  const password = await loadOrCreatePassword()
  cachedAuth = `Basic ${Buffer.from(`opencode:${password}`).toString('base64')}`
  return cachedAuth
}

async function request(method, apiPath, body) {
  const { url } = await ensureServer()
  const auth = await getAuth()
  const headers = { Authorization: auth }
  let payload
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  const r = await fetch(`${url}${apiPath}`, { method, headers, body: payload })
  const text = await r.text()
  let json = null
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      json = { raw: text }
    }
  }
  if (!r.ok) {
    throw new Error(`OpenCode API ${method} ${apiPath} 失败: HTTP ${r.status} ${text.slice(0, 200)}`)
  }
  return json
}

// ---------- 权限规则集 ----------

/**
 * 默认权限规则集（后匹配优先）：
 *   - 项目内只读巡检命令自动放行
 *   - 其余 shell 询问用户
 *   - 危险命令 / 项目外目录直接拒绝
 */
export const DEFAULT_PERMISSIONS = [
  // 默认：shell 一律询问
  { action: 'shell', resource: '*', effect: 'ask' },
  // 只读 git 巡检放行
  { action: 'shell', resource: 'git status *', effect: 'allow' },
  { action: 'shell', resource: 'git diff *', effect: 'allow' },
  { action: 'shell', resource: 'git log *', effect: 'allow' },
  { action: 'shell', resource: 'git branch *', effect: 'allow' },
  { action: 'shell', resource: 'git rev-parse *', effect: 'allow' },
  { action: 'shell', resource: 'git ls-files *', effect: 'allow' },
  { action: 'shell', resource: 'git show *', effect: 'allow' },
  // 只读 PowerShell 巡检 / 目录列举 / 管道处理放行（开发场景高频且安全）
  { action: 'shell', resource: 'systeminfo*', effect: 'allow' },
  { action: 'shell', resource: 'Get-ComputerInfo*', effect: 'allow' },
  { action: 'shell', resource: 'Get-Location*', effect: 'allow' },
  { action: 'shell', resource: 'Get-ChildItem*', effect: 'allow' },
  { action: 'shell', resource: 'Get-Date*', effect: 'allow' },
  { action: 'shell', resource: 'Set-Location*', effect: 'allow' },
  { action: 'shell', resource: 'cd *', effect: 'allow' },
  { action: 'shell', resource: 'pwd*', effect: 'allow' },
  { action: 'shell', resource: 'hostname*', effect: 'allow' },
  { action: 'shell', resource: 'ver*', effect: 'allow' },
  { action: 'shell', resource: 'Select-Object*', effect: 'allow' },
  { action: 'shell', resource: 'Where-Object*', effect: 'allow' },
  { action: 'shell', resource: 'Sort-Object*', effect: 'allow' },
  { action: 'shell', resource: 'Measure-Object*', effect: 'allow' },
  { action: 'shell', resource: 'ForEach-Object*', effect: 'allow' },
  { action: 'shell', resource: 'Write-Output*', effect: 'allow' },
  // 项目内读写默认允许（location 内路径）
  { action: 'read', resource: '*', effect: 'allow' },
  { action: 'edit', resource: '*', effect: 'allow' },
  // 项目外目录一律拒绝
  { action: 'external_directory', resource: '*', effect: 'deny' },
  // 危险命令拒绝
  { action: 'shell', resource: 'rm -rf *', effect: 'deny' },
  { action: 'shell', resource: 'rm -r *', effect: 'deny' },
  { action: 'shell', resource: 'del * /s /q', effect: 'deny' },
  { action: 'shell', resource: 'format *', effect: 'deny' },
  { action: 'shell', resource: 'shutdown *', effect: 'deny' },
  { action: 'shell', resource: 'restart *', effect: 'deny' },
]

// ---------- API 封装 ----------

/**
 * 创建 session。
 * @param {object} opts { title, model, agent, permissions }
 */
export async function createSession(opts = {}) {
  const body = {
    title: opts.title || 'AI 开发会话',
    location: { directory: PROJECT_ROOT },
  }
  // 指定 agent 时用 agent 自带权限；否则用默认规则集
  const permissions = opts.permissions || (opts.agent ? undefined : DEFAULT_PERMISSIONS)
  if (permissions) body.permissions = permissions
  if (opts.model) {
    const [providerID, modelID] = String(opts.model).split('/')
    body.model = { id: modelID || opts.model, providerID }
  }
  if (opts.agent) body.agent = opts.agent
  const json = await request('POST', '/api/session', body)
  return json?.data || json
}

/**
 * 列出可用 agent（用于校验流水线 agent 是否已注入成功）。
 */
export async function listAgents() {
  const json = await request('GET', '/api/agent')
  return json?.data || []
}

/**
 * 列出当前项目（目录）下的 session。
 */
export async function listSessions() {
  const json = await request('GET', `/api/session?directory=${encodeURIComponent(PROJECT_ROOT)}&limit=50`)
  return json?.data || []
}

/**
 * 向 session 发送消息。
 */
export async function prompt(sessionId, text) {
  const json = await request('POST', `/api/session/${sessionId}/prompt`, { text })
  return json?.data || json
}

/**
 * 读取 session 的全部消息。
 */
export async function getMessages(sessionId) {
  const json = await request('GET', `/api/session/${sessionId}/message`)
  return json?.data || []
}

/**
 * 列出会话挂起的权限请求。
 * @param {string} sessionId
 * @returns {Array} pending 权限请求数组
 */
export async function listPermissions(sessionId) {
  const json = await request('GET', `/api/session/${sessionId}/permission`)
  return json?.data || []
}

/**
 * 回复会话的权限请求。
 * @param {string} sessionId
 * @param {string} requestId
 * @param {'once'|'always'|'reject'} decision
 */
export async function replyPermission(sessionId, requestId, decision) {
  await request('POST', `/api/session/${sessionId}/permission/${requestId}/reply`, { decision })
  return true
}

/**
 * 打开 serve 的 SSE 事件流（GET /api/event）。
 * @returns {Promise<Response>} fetch 响应，调用方负责消费 body
 */
export async function openEventStream() {
  const { url } = await ensureServer()
  const auth = await getAuth()
  return fetch(`${url}/api/event`, {
    headers: { Authorization: auth, Accept: 'text/event-stream' },
  })
}

/**
 * 删除 session。
 */
export async function deleteSession(sessionId) {
  await request('DELETE', `/api/session/${sessionId}`)
  return true
}
