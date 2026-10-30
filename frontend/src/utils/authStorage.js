/**
 * 认证信息存储。
 *
 * Web 的 localStorage 是同源所有标签页共享的：同一浏览器登录甲、乙两个账号时，
 * 后登录的账号会覆盖先登录的 token，刷新先登录的标签页就会变成另一个账号。
 *
 * 这里统一使用 sessionStorage：每个标签页各存一份，刷新保持，关闭标签页即失效。
 * 首次升级时把旧 localStorage 中的认证信息迁移到当前标签页，然后清理旧键，
 * 避免新标签页继续读到旧账号。
 */
const AUTH_KEY = 'thesisforge.auth'
const LEGACY_KEYS = ['token', 'user', 'menus']
let migrated = false

function safeParse(raw, fallback) {
  if (!raw) return fallback
  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function normalize(data) {
  if (!data || typeof data !== 'object') return null
  return {
    token: typeof data.token === 'string' ? data.token : '',
    user: data.user && typeof data.user === 'object' ? data.user : null,
    menus: Array.isArray(data.menus) ? data.menus : [],
  }
}

function clearLegacy() {
  try {
    LEGACY_KEYS.forEach((key) => localStorage.removeItem(key))
  } catch {
    // 隐私模式等场景下 localStorage 不可用时忽略
  }
}

function migrateLegacy() {
  if (migrated) return
  migrated = true

  try {
    const existing = safeParse(sessionStorage.getItem(AUTH_KEY), null)
    if (!existing) {
      const token = localStorage.getItem('token')
      if (token) {
        const auth = normalize({
          token,
          user: safeParse(localStorage.getItem('user'), null),
          menus: safeParse(localStorage.getItem('menus'), []),
        })
        if (auth) {
          sessionStorage.setItem(AUTH_KEY, JSON.stringify(auth))
        }
      }
    }
  } catch {
    // sessionStorage 不可用时退化为未登录
  }

  clearLegacy()
}

/** 读取当前标签页认证信息；无登录态返回 null。 */
export function getAuth() {
  migrateLegacy()
  try {
    return normalize(safeParse(sessionStorage.getItem(AUTH_KEY), null))
  } catch {
    return null
  }
}

/** 当前标签页 token，无登录态返回空字符串。 */
export function getToken() {
  return getAuth()?.token || ''
}

/** 当前标签页用户信息，无登录态返回 null。 */
export function getUser() {
  return getAuth()?.user || null
}

/** 当前标签页菜单，无登录态返回空数组。 */
export function getMenus() {
  return getAuth()?.menus || []
}

/** 写入当前标签页认证信息。 */
export function setAuth({ token, user, menus }) {
  migrateLegacy()
  try {
    const auth = normalize({ token, user, menus })
    if (auth) {
      sessionStorage.setItem(AUTH_KEY, JSON.stringify(auth))
    }
  } catch {
    // 写入失败时保持内存状态，至少当前页面仍可用
  }
  clearLegacy()
}

/** 清除当前标签页认证信息（不影响其它标签页）。 */
export function clearAuth() {
  try {
    sessionStorage.removeItem(AUTH_KEY)
  } catch {
    // 忽略
  }
  clearLegacy()
}
