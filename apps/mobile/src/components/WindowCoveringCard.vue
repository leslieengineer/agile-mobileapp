<script setup lang="ts">
import { computed, ref } from 'vue'
import { CLUSTERS } from '@rhophi/client-sdk'
import { IonButton, IonButtons, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle } from '@ionic/vue'
import { useDeviceStore } from '@rhophi/client-sdk'
import { api } from '../services/api'

const props = defineProps<{ nodeId: string; endpoint: number }>()
const devices = useDeviceStore()
const error = ref('')
const busy = ref(false)
const position = computed(() => Number(devices.attributes(props.nodeId, props.endpoint, CLUSTERS.WindowCovering).CurrentPositionLiftPercent100ths ?? 0) / 100)
async function send(command: 'UpOrOpen' | 'StopMotion' | 'DownOrClose') {
  busy.value = true
  error.value = ''
  try {
    const response = await api.sendCommand({ node_id: props.nodeId, endpoint: props.endpoint, cluster: 'WindowCovering', command, payload: {} })
    if (response.status === 'error') throw new Error(response.error.message)
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Command failed'
  } finally {
    busy.value = false
  }
}
</script>
<template><ion-card><ion-card-header><ion-card-subtitle>Endpoint {{ endpoint }}</ion-card-subtitle><ion-card-title>Window · {{ position }}%</ion-card-title></ion-card-header><ion-card-content><ion-buttons><ion-button :disabled="busy" @click="send('UpOrOpen')">Open</ion-button><ion-button :disabled="busy" @click="send('StopMotion')">Stop</ion-button><ion-button :disabled="busy" @click="send('DownOrClose')">Close</ion-button></ion-buttons><p v-if="error" class="error">{{ error }}</p></ion-card-content></ion-card></template>
