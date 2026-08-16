<script setup lang="ts">
import { computed, ref } from 'vue'
import { CLUSTERS } from '@rhophi/client-sdk'
import { IonButton, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle, IonChip } from '@ionic/vue'
import { useDeviceStore } from '@rhophi/client-sdk'
import { api } from '../services/api'

const props = defineProps<{ nodeId: string; endpoint: number }>()
const devices = useDeviceStore()
const busy = ref(false)
const target = ref<boolean>()
const error = ref('')
const reported = computed(() => Boolean(devices.attributes(props.nodeId, props.endpoint, CLUSTERS.OnOff).OnOff))
const on = computed(() => target.value ?? reported.value)

async function toggle() {
  const previous = on.value
  target.value = !previous
  busy.value = true
  error.value = ''
  try {
    const response = await api.sendCommand({ node_id: props.nodeId, endpoint: props.endpoint, cluster: 'OnOff', command: previous ? 'Off' : 'On', payload: {} })
    if (response.status === 'error') throw new Error(response.error.message)
  } catch (reason) {
    target.value = previous
    error.value = reason instanceof Error ? reason.message : 'Command failed'
  } finally {
    busy.value = false
    target.value = undefined
  }
}
</script>
<template><ion-card><ion-card-header><ion-card-subtitle>Endpoint {{ endpoint }}</ion-card-subtitle><ion-card-title>Smart switch <ion-chip :color="on ? 'success' : 'medium'">{{ on ? 'ON' : 'OFF' }}</ion-chip></ion-card-title></ion-card-header><ion-card-content><p v-if="error" class="error">{{ error }}</p><ion-button expand="block" :disabled="busy" @click="toggle">Turn {{ on ? 'off' : 'on' }}</ion-button></ion-card-content></ion-card></template>
