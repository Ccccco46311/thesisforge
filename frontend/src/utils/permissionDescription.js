/**
 * 权限请求的描述与风险展示。
 *
 * AI 描述由后端 /api/ai/chat/permission/describe 生成；
 * 这里提供本地规则版，作为模型不可用、超时或返回异常时的兜底。
 */

export const RISK_META = {
  read: { label: '只读', type: 'success' },
  write: { label: '会修改文件', type: 'warning' },
  execute: { label: '会执行命令', type: 'primary' },
  network: { label: '会联网', type: 'info' },
  destructive: { label: '危险操作', type: 'danger' },
}

export function getRiskMeta(risk) {
  return RISK_META[risk] || RISK_META.execute
}

const DESTRUCTIVE = /(^|[;&|]\s*)(rm|del|erase|rmdir|rd|remove-item|git\s+reset\s+--hard|git\s+clean|git\s+push\s+[^\n]*--force)|drop\s+table|truncate\s+table/i
const NETWORK = /(^|[\s;&|])(curl|wget|invoke-webrequest|invoke-restmethod|irm|iwr)\b/i
const GIT_WRITE = /\bgit\s+(add|commit|push|pull|fetch|checkout|switch|merge|rebase|stash|tag|init|clone)\b/i
const PS_WRITE = /\b(set-content|out-file|add-content|new-item|copy-item|move-item|rename-item)\b/i
const BUILD = /\b(mvn|mvnw|gradle|npm|pnpm|yarn)\s+(clean|compile|package|install|test|verify|i|add|run\s+build|run\s+dev|build)\b/i
const READ_ONLY = /\bgit\s+(status|diff|log|show|branch|rev-parse|ls-files|blame|remote|config\s+--get)\b|\b(get-childitem|dir|ls|get-content|cat|type|select-string|findstr|get-item|test-path|get-process|get-nettcpconnection|get-date|where|which)\b|--version\b|\s-v\b/i

function truncate(text, max) {
  const s = String(text || '').replace(/\s+/g, ' ').trim()
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

function firstCommand(request) {
  const resources = Array.isArray(request?.resources) ? request.resources : []
  return truncate(resources[0] || '', 36)
}

function fileOf(request) {
  const files = request?.metadata?.files
  if (Array.isArray(files) && files[0]?.file) return files[0].file
  const resources = Array.isArray(request?.resources) ? request.resources : []
  return resources[0] || ''
}

/**
 * 本地规则生成兜底描述。
 *
 * @param {object} request 权限请求 { action, resources, metadata, message }
 * @returns {{summary: string, risk: string, risks: string[]}}
 */
export function describePermissionFallback(request = {}) {
  const action = String(request.action || '').toLowerCase()
  const command = firstCommand(request)
  const path = truncate(fileOf(request), 48)

  if (request.message) {
    return { summary: truncate(request.message, 40), risk: 'execute', risks: [] }
  }

  if (action === 'edit' || action === 'write' || action === 'patch') {
    return {
      summary: path ? `修改文件：${path}` : '修改项目文件',
      risk: 'write',
      risks: ['会覆盖或改写文件内容'],
    }
  }

  if (action === 'shell' || action === 'bash') {
    if (DESTRUCTIVE.test(command)) {
      return {
        summary: command ? `执行危险操作：${command}` : '执行可能破坏数据的操作',
        risk: 'destructive',
        risks: ['可能删除、覆盖数据或强制推送'],
      }
    }
    if (NETWORK.test(command)) {
      return {
        summary: command ? `访问网络：${command}` : '访问外部网络',
        risk: 'network',
        risks: ['会向外部地址发起请求'],
      }
    }
    if (GIT_WRITE.test(command)) {
      return {
        summary: command ? `修改 Git 仓库：${command}` : '修改 Git 仓库状态',
        risk: 'write',
        risks: ['会改变提交历史或工作区状态'],
      }
    }
    if (PS_WRITE.test(command)) {
      return {
        summary: command ? `写入文件：${command}` : '写入项目文件',
        risk: 'write',
        risks: ['会修改文件内容'],
      }
    }
    if (BUILD.test(command)) {
      return {
        summary: command ? `构建或安装依赖：${command}` : '构建项目或安装依赖',
        risk: 'write',
        risks: ['会生成构建产物或修改依赖目录'],
      }
    }
    if (READ_ONLY.test(command)) {
      return {
        summary: command ? `查看项目内容：${command}` : '查看项目内容',
        risk: 'read',
        risks: [],
      }
    }
    return {
      summary: command ? `执行命令：${command}` : '执行命令',
      risk: 'execute',
      risks: ['命令影响范围需要人工确认'],
    }
  }

  if (['read', 'glob', 'grep', 'list'].includes(action)) {
    return { summary: '读取或搜索项目文件', risk: 'read', risks: [] }
  }
  if (action === 'webfetch' || action === 'websearch') {
    return { summary: '访问网络资源', risk: 'network', risks: ['会访问外部网络'] }
  }
  if (action === 'task') {
    return { summary: '调用子代理执行任务', risk: 'execute', risks: ['子代理可能修改文件'] }
  }
  if (action === 'external_directory') {
    return {
      summary: path ? `访问项目外目录：${path}` : '访问项目外目录',
      risk: 'write',
      risks: ['可能读写项目目录之外的文件'],
    }
  }

  return {
    summary: action ? `执行 ${action} 操作` : '执行未知操作',
    risk: 'execute',
    risks: ['操作影响范围需要人工确认'],
  }
}

const RISK_SEVERITY = {
  read: 0,
  execute: 1,
  network: 2,
  write: 2,
  destructive: 3,
}

/**
 * 规范化后端返回的描述，避免异常数据影响渲染。
 * 同时用本地规则做风险下限：模型判断偏轻时按更严重的等级展示。
 */
export function normalizePermissionDescription(data, fallback) {
  if (!data || typeof data.summary !== 'string' || !data.summary.trim()) {
    return fallback
  }

  let risk = RISK_META[data.risk] ? data.risk : 'execute'
  const risks = Array.isArray(data.risks)
    ? data.risks.filter((x) => typeof x === 'string' && x.trim()).slice(0, 3).map((x) => truncate(x, 60))
    : []

  if (fallback && RISK_SEVERITY[fallback.risk] > RISK_SEVERITY[risk]) {
    risk = fallback.risk
    for (const item of fallback.risks) {
      if (risks.length >= 3) break
      if (!risks.includes(item)) risks.push(item)
    }
  }

  return {
    summary: truncate(data.summary, 80),
    risk,
    risks,
  }
}
