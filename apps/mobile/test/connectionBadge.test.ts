// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { IonicVue } from '@ionic/vue'
import { useConnectionStore } from '@rhophi/client-sdk'
import ConnectionBadge from '../src/components/ConnectionBadge.vue'

describe('ConnectionBadge', () => {
  it('reflects realtime connection state', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(ConnectionBadge, { global: { plugins: [pinia, IonicVue] } })
    expect(wrapper.text()).toContain('Offline')
    useConnectionStore().update(true)
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Live')
  })
})
