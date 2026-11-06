/**
 * AI 调用失败时的友好错误文案。
 *
 * OpenCode 失败时会在 idle 消息里带 outcome='failed' 和 error 结构：
 *   { type, message, status?, response?: { body? }, retryAfterMs? }
 * 这里按常见 HTTP 状态 / 网络错误翻译成用户能看懂的中文提示。
 */

const CONFIG_HINT = '请到「AI 供应商配置」检查 API Key、接口地址和模型名称。'

export function friendlyAiErrorMessage(error = {}) {
  const status = Number(error?.status) || 0
  const type = String(error?.type || '')
  const detail = String(error?.response?.body || error?.message || '').trim()

  if (status === 401 || status === 403
    || /authentication|unauthorized|invalid api key|api key.*incorrect|incorrect api key/i.test(detail)) {
    return `API Key 无效或没有访问权限（HTTP ${status || '401/403'}）。${CONFIG_HINT}`
  }
  if (status === 404) {
    return `接口地址或模型名称不正确（HTTP 404）。${CONFIG_HINT}`
  }
  if (status === 429 || /rate limit|quota|insufficient_quota|额度/i.test(detail)) {
    return '请求过于频繁或账户额度不足（HTTP 429），请稍后重试或检查账户余额。'
  }
  if (type === 'provider.no-route'
    || /model unavailable|no such model|model not found|unsupported model|模型.*不可用/i.test(detail)) {
    return `模型不可用：${detail || '请检查模型名称'}。${CONFIG_HINT}`
  }
  if (status >= 500) {
    return `模型服务端错误（HTTP ${status}），请稍后重试；持续失败请检查供应商服务状态。`
  }
  if (/ECONNREFUSED|ENOTFOUND|fetch failed|network|timeout|timed out|abort/i.test(detail)) {
    return `无法连接到接口地址（网络、代理或超时）。${CONFIG_HINT}`
  }
  if (status) {
    return `模型调用失败（HTTP ${status}）。${CONFIG_HINT}`
  }
  return `模型调用失败。${CONFIG_HINT}`
}

/**
 * 把 idle 失败消息格式化成聊天里的系统提示。
 */
export function formatAiError(idleMsg) {
  if (!idleMsg) return 'AI 回复失败'
  if (idleMsg.outcome === 'interrupted') return '⏹ AI 执行被中断'
  const err = idleMsg.error || {}
  const friendly = friendlyAiErrorMessage(err)
  const detail = String(err?.response?.body || err?.message || '').trim()
  return `⚠ ${friendly}${detail ? `\n\n原始错误：${detail.slice(0, 300)}` : ''}`
}

/** 判断一条消息是否代表本轮执行已结束（成功 / 失败 / 中断）。 */
export function isIdleDone(m) {
  return m?.type === 'idle' && ['succeeded', 'failed', 'interrupted'].includes(m.outcome)
}
