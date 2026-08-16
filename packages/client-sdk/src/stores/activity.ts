import type { CommandResponse, MatterEvent } from '../contracts.js'
import { defineStore } from 'pinia'

export const useActivityStore = defineStore('activity', {
  state: () => ({ items: [] as Array<CommandResponse | MatterEvent> }),
  actions: {
    push(message: CommandResponse | MatterEvent) {
      this.items.unshift(message)
      this.items = this.items.slice(0, 20)
    },
  },
})
