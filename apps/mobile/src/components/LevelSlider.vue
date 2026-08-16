<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CLUSTERS } from '@rhophi/client-sdk'
import { IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle, IonRange } from '@ionic/vue'
import { useDeviceStore } from '@rhophi/client-sdk'
import { api } from '../services/api'

const props = defineProps<{ nodeId: string; endpoint: number }>()
const devices = useDeviceStore()
const reported = computed(() => Number(devices.attributes(props.nodeId, props.endpoint, CLUSTERS.LevelControl).CurrentLevel ?? 0))
const level = ref(reported.value)
const error = ref('')
watch(reported, value => level.value = value)

async function send(event: CustomEvent) {
  const next = Number(event.detail.value)
  const previous = reported.value
  level.value = next
  error.value = ''
  try {
    const response = await api.sendCommand({ node_id: props.nodeId, endpoint: props.endpoint, cluster: 'LevelControl', command: 'MoveToLevelWithOnOff', payload: { level: next, transitionTime: 5 } })
    if (response.status === 'error') throw new Error(response.error.message)
  } catch (reason) {
    level.value = previous
    error.value = reason instanceof Error ? reason.message : 'Command failed'
  }
}
</script>
<template><ion-card><ion-card-header><ion-card-subtitle>Endpoint {{ endpoint }}</ion-card-subtitle><ion-card-title>Light level · {{ Math.round(level / 2.54) }}%</ion-card-title></ion-card-header><ion-card-content><ion-range :value="level" :min="0" :max="254" @ion-change="send" /><p v-if="error" class="error">{{ error }}</p></ion-card-content></ion-card></template>
