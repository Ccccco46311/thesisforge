import { defineStore } from 'pinia'
import { clearAuth, getAuth, setAuth } from '@/utils/authStorage'

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
  state: () => {
    const auth = getAuth()
    return {
      token: auth?.token || '',
      userInfo: auth?.user || null,
      menus: auth?.menus || [],
    }
  },
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
      setAuth({
        token: this.token,
        user: this.userInfo,
        menus: this.menus,
      })
    },
    logout() {
      this.token = ''
      this.userInfo = null
      this.menus = []
      clearAuth()
    },
  },
})
