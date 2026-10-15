import express from 'express'
import cors from 'cors'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 项目根目录（bridge 的上级目录）
const PROJECT_ROOT = path.resolve(__dirname, '..')

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
 * body: { provider, apiKey, baseUrl, model, dbHost, dbPort, dbName, dbUser, dbPassword, opencodeUrl }
 * 将 AI 供应商配置写入 bridge/opencode.json（OpenCode 配置文件）。
 */
app.post('/provider/apply', async (req, res) => {
  try {
    const config = req.body || {}
    const opencodeConfigPath = path.join(__dirname, 'opencode.json')

    // 读取已有配置（若存在）
    let existing = {}
    try {
      existing = JSON.parse(await fs.readFile(opencodeConfigPath, 'utf8'))
    } catch {
      // 首次写入
    }

    // 组装 provider 配置（OpenCode 兼容：provider id 与 baseURL）
    const providerId = config.provider || 'deepseek'
    const providerConfig = {
      id: providerId,
      apiKey: config.apiKey || '',
      baseURL: config.baseUrl || '',
      models: config.model ? [{ id: config.model }] : [],
    }

    const merged = {
      ...existing,
      provider: {
        ...(existing.provider || {}),
        [providerId]: providerConfig,
      },
      model: config.model || existing.model || 'deepseek-chat',
    }

    await fs.writeFile(opencodeConfigPath, JSON.stringify(merged, null, 2), 'utf8')
    res.json({ code: 200, msg: 'ok', data: { written: opencodeConfigPath } })
  } catch (e) {
    res.status(500).json({ code: 500, msg: `写入 OpenCode 配置失败: ${e.message}`, data: null })
  }
})

app.listen(PORT, () => {
  console.log(`[bridge] ThesisForge bridge listening on http://localhost:${PORT}`)
  console.log(`[bridge] Project root: ${PROJECT_ROOT}`)
})
