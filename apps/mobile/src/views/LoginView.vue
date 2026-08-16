<script setup lang="ts">
import { ref } from 'vue'
import { IonButton, IonCard, IonCardContent, IonContent, IonInput, IonPage, IonSpinner } from '@ionic/vue'
import { useSessionStore } from '@rhophi/client-sdk'
import { api } from '../services/api'
import { startRealtime } from '../services/realtime'
import { router } from '../router'

const username = ref('')
const password = ref('')
const busy = ref(false)
const session = useSessionStore()

async function login() {
  busy.value = true
  session.error = ''
  try {
    const current = await api.login(username.value, password.value)
    password.value = ''
    session.set(current.username)
    startRealtime()
    await router.replace('/tabs/home')
  } catch (error) {
    session.clear(error instanceof Error ? error.message : 'Login failed')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <div class="page login-page">
        <p class="eyebrow">Matter over Thread</p>
        <h1>Rhophi</h1>
        <p class="muted">Sign in to your Rhophi gateway.</p>
        <ion-card>
          <ion-card-content>
            <ion-input v-model="username" label="Username" label-placement="stacked" autocomplete="username" />
            <ion-input v-model="password" label="Password" label-placement="stacked" type="password" autocomplete="current-password" @keyup.enter="login" />
            <p v-if="session.error" class="error">{{ session.error }}</p>
            <ion-button expand="block" :disabled="busy || !username || password.length < 8" @click="login">
              <ion-spinner v-if="busy" name="crescent" />
              <span v-else>Sign in</span>
            </ion-button>
          </ion-card-content>
        </ion-card>
      </div>
    </ion-content>
  </ion-page>
</template>

<style scoped>.login-page { padding-top: 18vh; max-width: 460px; } h1 { font-size: 3rem; margin: 4px 0; }</style>
