import express from 'express'
import cors from 'cors'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import {
  ensureServer,
  stopServer,
  createSession,
  listSessions,
  listAgents,
  prompt,
  getMessages,
  getSessionInfo,
  compactSession,
  deleteSession,
  applyProvider,
  openEventStream,
  replyPermission,
  listPermissions,
  describePermission,
  PROJECT_ROOT,
} from './opencode.js'

const execFileAsync = promisify(execFile)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
const PORT = process.env.BRIDGE_PORT || 3010

app.use(cors())
app.use(express.json())

/**
 * 在项目根目录执行 git 命令。
 */
async function git(...args) {
  const { stdout, stderr } = await execFileAsync('git', args, {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
  })
  if (stderr && !stdout) {
    throw new Error(stderr)
  }
  return stdout.trim()
}

// ---------- git 操作 ----------

/**
 * POST /git/commit
 * body: { message: string }
 * 提交当前工作区全部改动，返回 commit hash。
 */
app.post('/git/commit', async (req, res) => {
  try {
    const message = req.body?.message || 'ThesisForge: 节点提交'
    await git('add', '-A')
    const { stdout } = await execFileAsync('git', ['diff', '--cached', '--quiet'], {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
    }).catch(() => ({ stdout: '' }))

    // diff --cached --quiet 退出码 0 表示无改动，非 0 表示有改动
    let commitHash = null
    try {
      await git('diff', '--cached', '--quiet')
      // 无改动：不创建空提交，直接返回当前 HEAD
      commitHash = await git('rev-parse', 'HEAD')
    } catch {
      // 有改动：正常提交
      commitHash = await git('commit', '-m', message)
    }

    // git commit 输出不直接给 hash，需要单独取
    commitHash = await git('rev-parse', 'HEAD')
    res.json({ code: 200, msg: 'ok', data: commitHash })
  } catch (e) {
    res.status(500).json({ code: 500, msg: `git commit 失败: ${e.message}`, data: null })
  }
})

/**
 * GET /git/status
 * 返回当前工作区是否有未提交改动。
 */
app.get('/git/status', async (req, res) => {
  try {
    const { stdout } = await execFileAsync('git', ['status', '--porcelain'], {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
    })
    const changed = stdout.trim().split('\n').filter(Boolean)
    res.json({ code: 200, msg: 'ok', data: { dirty: changed.length > 0, files: changed } })
  } catch (e) {
    res.status(500).json({ code: 500, msg: `git status 失败: ${e.message}`, data: null })
  }
})

// ---------- 供应商配置 ----------

/**
 * POST /provider/apply
 * body: { provider, apiKey, baseUrl, model, dbHost, dbPort, dbName, dbUser, dbPassword, opencodeUrl, name }
 * 将 AI 供应商配置保存到 data/opencode/provider.json，并重启 serve 使配置生效。
 */
app.post('/provider/apply', async (req, res) => {
  try {
    const config = req.body || {}
    await applyProvider({
      provider: config.provider || 'custom',
      apiKey: config.apiKey || '',
      baseUrl: config.baseUrl || '',
      model: config.model || '',
      name: config.name || config.provider || 'custom',
    })
    res.json({ code: 200, msg: 'ok', data: { applied: true } })
  } catch (e) {
    res.status(500).json({ code: 500, msg: `应用 OpenCode 配置失败: ${e.message}`, data: null })
  }
})

// ---------- OpenCode 会话 API ----------

/**
 * GET /api/opencode/agents
 * 列出 OpenCode 当前可用的 agent（用于确认流水线 agent 是否注入成功）。
 */
app.get('/api/opencode/agents', async (req, res) => {
  try {
    const agents = await listAgents()
    res.json({ code: 200, msg: 'ok', data: agents })
  } catch (e) {
    res.status(500).json({ code: 500, msg: `获取 agent 列表失败: ${e.message}`, data: null })
  }
})

/**
 * POST /api/opencode/restart
 * 重启 opencode serve 进程（用于 opencode 执行引擎偶发卡死时自愈）。
 * 会话数据持久化在 opencode.db，重启后不丢失。
 */
app.post('/api/opencode/restart', async (req, res) => {
  try {
    await stopServer()
    await ensureServer()
    res.json({ code: 200, msg: 'ok', data: { running: true } })
  } catch (e) {
    res.status(500).json({ code: 500, msg: `重启 opencode serve 失败: ${e.message}`, data: null })
  }
})

/**
 * GET /api/opencode/status
 * 返回 serve 运行状态。
 */
app.get('/api/opencode/status', async (req, res) => {
  try {
    const { url } = await ensureServer()
    res.json({ code: 200, msg: 'ok', data: { running: true, url, projectRoot: PROJECT_ROOT } })
  } catch (e) {
    res.status(500).json({ code: 500, msg: `OpenCode serve 未就绪: ${e.message}`, data: null })
  }
})

/**
 * GET /api/opencode/sessions
 * 列出当前项目的 session（目录过滤）。
 */
app.get('/api/opencode/sessions', async (req, res) => {
  try {
    const sessions = await listSessions()
    res.json({ code: 200, msg: 'ok', data: sessions })
  } catch (e) {
    res.status(500).json({ code: 500, msg: `获取会话列表失败: ${e.message}`, data: null })
  }
})

/**
 * POST /api/opencode/sessions
 * body: { title, model, agent, permissions }
 * 创建会话（绑定项目目录 + 默认权限规则集）。
 */
app.post('/api/opencode/sessions', async (req, res) => {
  try {
    const body = req.body || {}
    const session = await createSession({
      title: body.title,
      model: body.model,
      agent: body.agent,
      // 不在这里兜底 DEFAULT_PERMISSIONS：传 undefined 时由 createSession
      // 决定（有 agent 用该 agent 的权限；否则用默认规则集），否则 agent 权限永远不生效
      permissions: body.permissions,
    })
    res.json({ code: 200, msg: 'ok', data: session })
  } catch (e) {
    res.status(500).json({ code: 500, msg: `创建会话失败: ${e.message}`, data: null })
  }
})

/**
 * POST /api/opencode/sessions/:id/prompt
 * body: { text }
 * 发送消息。
 */
app.post('/api/opencode/sessions/:id/prompt', async (req, res) => {
  try {
    const text = req.body?.text
    if (!text) {
      return res.status(400).json({ code: 400, msg: 'text 不能为空', data: null })
    }
    const result = await prompt(req.params.id, text)
    res.json({ code: 200, msg: 'ok', data: result })
  } catch (e) {
    res.status(500).json({ code: 500, msg: `发送消息失败: ${e.message}`, data: null })
  }
})

/**
 * GET /api/opencode/sessions/:id/message
 * 读取会话消息。
 */
app.get('/api/opencode/sessions/:id/message', async (req, res) => {
  try {
    const messages = await getMessages(req.params.id)
    res.json({ code: 200, msg: 'ok', data: messages })
  } catch (e) {
    res.status(500).json({ code: 500, msg: `读取消息失败: ${e.message}`, data: null })
  }
})

/**
 * GET /api/opencode/sessions/:id/info
 * 读取会话详情（含 tokens 使用量，用于展示上下文占用）。
 */
app.get('/api/opencode/sessions/:id/info', async (req, res) => {
  try {
    const info = await getSessionInfo(req.params.id)
    res.json({ code: 200, msg: 'ok', data: info })
  } catch (e) {
    res.status(500).json({ code: 500, msg: `读取会话信息失败: ${e.message}`, data: null })
  }
})

/**
 * POST /api/opencode/sessions/:id/compact
 * 请求压缩会话上下文（异步执行）。
 */
app.post('/api/opencode/sessions/:id/compact', async (req, res) => {
  try {
    const data = await compactSession(req.params.id)
    res.json({ code: 200, msg: 'ok', data })
  } catch (e) {
    res.status(500).json({ code: 500, msg: `压缩上下文失败: ${e.message}`, data: null })
  }
})

/**
 * GET /api/opencode/sessions/:id/permission
 * 读取会话挂起的权限请求（前端兜底轮询用）。
 */
app.get('/api/opencode/sessions/:id/permission', async (req, res) => {
  try {
    const perms = await listPermissions(req.params.id)
    res.json({ code: 200, msg: 'ok', data: perms })
  } catch (e) {
    res.status(500).json({ code: 500, msg: `读取权限请求失败: ${e.message}`, data: null })
  }
})

/**
 * POST /api/opencode/sessions/:id/permission/:requestId/reply
 * body: { decision: 'once'|'always'|'reject' }
 * 回复权限请求（shell ask 弹窗）。
 */
app.post('/api/opencode/sessions/:id/permission/:requestId/reply', async (req, res) => {
  try {
    const decision = req.body?.decision
    if (!['once', 'always', 'reject'].includes(decision)) {
      return res.status(400).json({ code: 400, msg: 'decision 必须为 once/always/reject', data: null })
    }
    await replyPermission(req.params.id, req.params.requestId, decision)
    res.json({ code: 200, msg: 'ok', data: true })
  } catch (e) {
    res.status(500).json({ code: 500, msg: `回复权限请求失败: ${e.message}`, data: null })
  }
})

/**
 * POST /api/ai/permission/describe
 * body: 权限请求 { action, resources, metadata, message }
 * 调用已配置的模型，生成一句中文执行描述 + 风险点；失败时 data 为 null。
 */
app.post('/api/ai/permission/describe', async (req, res) => {
  try {
    const data = await describePermission(req.body || {})
    res.json({ code: 200, msg: 'ok', data })
  } catch (e) {
    res.json({ code: 200, msg: 'ok', data: null })
  }
})

/**
 * DELETE /api/opencode/sessions/:id
 * 删除会话。
 */
app.delete('/api/opencode/sessions/:id', async (req, res) => {
  try {
    await deleteSession(req.params.id)
    res.json({ code: 200, msg: 'ok', data: true })
  } catch (e) {
    res.status(500).json({ code: 500, msg: `删除会话失败: ${e.message}`, data: null })
  }
})

/**
 * GET /api/opencode/events
 * SSE 事件流：代理 serve 的 /api/event，向浏览器实时推送会话事件。
 */
app.get('/api/opencode/events', async (req, res) => {
  try {
    const upstream = await openEventStream()
    if (!upstream.ok) {
      res.status(502).json({ code: 502, msg: `上游事件流失败: HTTP ${upstream.status}`, data: null })
      return
    }
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders?.()

    const reader = upstream.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop()
          for (const line of lines) {
            if (line.trim()) res.write(line + '\n')
          }
        }
        if (buffer.trim()) res.write(buffer + '\n')
        res.end()
      } catch (e) {
        console.error(`[bridge] SSE 转发中断: ${e.message}`)
        res.end()
      }
    }

    req.on('close', () => {
      reader.cancel().catch(() => {})
    })

    pump()
  } catch (e) {
    res.status(500).json({ code: 500, msg: `事件流失败: ${e.message}`, data: null })
  }
})

// ---------- 启动 ----------

async function main() {
  // 启动 OpenCode serve（失败不阻塞 bridge，仅打日志）
  ensureServer().catch((e) => {
    console.error(`[bridge] OpenCode serve 启动失败: ${e.message}`)
  })

  app.listen(PORT, () => {
    console.log(`[bridge] ThesisForge bridge listening on http://localhost:${PORT}`)
    console.log(`[bridge] Project root: ${PROJECT_ROOT}`)
  })
}

main()
