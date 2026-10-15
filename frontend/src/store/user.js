import { defineStore } from 'pinia'

export const useUserStore = defineStore('user', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    userInfo: JSON.parse(localStorage.getItem('user') || 'null'),
    menus: JSON.parse(localStorage.getItem('menus') || '[]'),
  }),
  getters: {
    isLogin: (state) => !!state.token,
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
