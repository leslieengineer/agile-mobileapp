<script setup lang="ts">
import { computed, ref } from 'vue'
import { CLUSTERS, TEST_VENDOR_ID } from '@rhophi/client-sdk'
import { IonButton, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle, IonRange } from '@ionic/vue'
import { useDeviceStore } from '@rhophi/client-sdk'
import { api } from '../services/api'

const props = defineProps<{ nodeId: string; endpoint: number }>()
const devices = useDeviceStore()
const error = ref('')
const attributes = computed(() => devices.attributes(props.nodeId, props.endpoint, CLUSTERS.VendorCooktop))
const zones = computed(() => (attributes.value.ZonePower as number[] | undefined) ?? [0, 0, 0, 0])
const locked = computed(() => Boolean(attributes.value.PanelLocked))
async function send(command: string, payload: Record<string, unknown>) {
  error.value = ''
  try {
    const response = await api.sendCommand({ node_id: props.nodeId, endpoint: props.endpoint, cluster: 'VendorCooktop', command, payload: { vendor_id: TEST_VENDOR_ID, ...payload } })
    if (response.status === 'error') throw new Error(response.error.message)
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Command failed'
  }
}
function setZone(zone: number, event: CustomEvent) {
  void send('SetZonePower', { zone, powerLevel: Number(event.detail.value) })
}
</script>
<template><ion-card><ion-card-header><ion-card-subtitle>Vendor cluster · Endpoint {{ endpoint }}</ion-card-subtitle><ion-card-title>Induction cooktop</ion-card-title></ion-card-header><ion-card-content><ion-button fill="outline" @click="send('LockPanel', { locked: !locked })">{{ locked ? 'Unlock panel' : 'Lock panel' }}</ion-button><div class="zones"><div v-for="(power,zone) in zones" :key="zone"><span>Zone {{ zone + 1 }} · {{ power }}</span><ion-range :disabled="locked" :value="power" :min="0" :max="9" @ion-change="setZone(zone, $event)" /></div></div><ion-button color="danger" fill="outline" @click="send('StopAll', {})">Stop all</ion-button><p v-if="error" class="error">{{ error }}</p></ion-card-content></ion-card></template>
<style scoped>.zones { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:16px 0; }</style>
