import { defineStore } from 'pinia'

export const useConnectionStore = defineStore('connection', {
  state: () => ({ connected: false, connecting: false, error: '' }),
  actions: {
    startConnecting() {
      this.connected = false
      this.connecting = true
      this.error = ''
    },
    update(connected: boolean, error = '') {
      this.connected = connected
      this.connecting = false
      this.error = error
    },
  },
})
