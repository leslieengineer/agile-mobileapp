<script setup lang="ts">
import { onMounted } from 'vue'
import { IonApp, IonRouterOutlet, IonSpinner } from '@ionic/vue'
import { useSessionStore } from '@rhophi/client-sdk'
import { api } from './services/api'
import { startRealtime, stopRealtime } from './services/realtime'
import { router } from './router'

const session = useSessionStore()

async function restoreSession() {
  try {
    const current = await api.session()
    session.set(current.username)
    startRealtime()
    if (router.currentRoute.value.path === '/login') await router.replace('/tabs/home')
  } catch {
    stopRealtime()
    session.clear()
    if (router.currentRoute.value.path !== '/login') await router.replace('/login')
  }
}

onMounted(() => {
  void restoreSession()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && session.authenticated) void restoreSession()
  })
})
</script>

<template>
  <ion-app>
    <div v-if="session.loading" class="app-loading"><ion-spinner name="crescent" /></div>
    <ion-router-outlet v-else />
  </ion-app>
</template>
