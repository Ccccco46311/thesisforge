import { defineStore } from 'pinia'

/**
 * 解析 JWT 的 exp，判断是否已过期（预留 30 秒余量）。
 * token 格式异常时视为有效，交给后端判定，避免误踢。
 */
function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (!payload.exp) return false
    return payload.exp * 1000 <= Date.now() + 30 * 1000
  } catch {
    return false
  }
}

export const useUserStore = defineStore('user', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    userInfo: JSON.parse(localStorage.getItem('user') || 'null'),
    menus: JSON.parse(localStorage.getItem('menus') || '[]'),
  }),
  getters: {
    isLogin: (state) => !!state.token && !isTokenExpired(state.token),
  },
  actions: {
    setLogin(data) {
      this.token = data.token
      this.userInfo = {
        userId: data.userId,
        username: data.username,
        nickname: data.nickname,
        roles: data.roles,
      }
      this.menus = data.menus || []
      localStorage.setItem('token', this.token)
      localStorage.setItem('user', JSON.stringify(this.userInfo))
      localStorage.setItem('menus', JSON.stringify(this.menus))
    },
    logout() {
      this.token = ''
      this.userInfo = null
      this.menus = []
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      localStorage.removeItem('menus')
    },
  },
})
