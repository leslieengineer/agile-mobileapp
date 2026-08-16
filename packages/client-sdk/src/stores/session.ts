import { defineStore } from 'pinia'

export const useSessionStore = defineStore('session', {
  state: () => ({ authenticated: false, username: '', loading: true, error: '' }),
  actions: {
    set(username: string) {
      this.authenticated = true
      this.username = username
      this.loading = false
      this.error = ''
    },
    clear(error = '') {
      this.authenticated = false
      this.username = ''
      this.loading = false
      this.error = error
    },
  },
})
