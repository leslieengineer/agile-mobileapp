<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { IonBackButton, IonButtons, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/vue'
import { phaseADeviceCatalog, useDeviceStore } from '@rhophi/client-sdk'
import { ref, onMounted } from 'vue'
import type { DeviceDescriptor } from '@rhophi/client-sdk'

const route = useRoute()
const descriptor = ref<DeviceDescriptor>()
const states = useDeviceStore()
const nodeId = computed(() => String(route.params.nodeId))
onMounted(async () => descriptor.value = (await phaseADeviceCatalog.list()).find(item => item.nodeId === nodeId.value))
const endpointStates = computed(() => Object.values(states.devices).filter(item => item.node_id === nodeId.value))
</script>
<template><ion-page><ion-header><ion-toolbar><ion-buttons slot="start"><ion-back-button default-href="/tabs/home" /></ion-buttons><ion-title>Device details</ion-title></ion-toolbar></ion-header><ion-content><div class="page"><ion-card><ion-card-header><ion-card-title>{{ descriptor?.name ?? 'Configured device' }}</ion-card-title></ion-card-header><ion-card-content><p><strong>Node</strong> {{ nodeId }}</p><p><strong>Product</strong> {{ descriptor?.product ?? 'Unknown' }}</p><p><strong>Connection</strong> REST/SSE gateway</p></ion-card-content></ion-card><ion-card><ion-card-header><ion-card-title>Endpoints and attributes</ion-card-title></ion-card-header><ion-card-content><p v-if="!endpointStates.length" class="muted">Attributes will appear after a realtime event or command response.</p><pre v-else>{{ JSON.stringify(endpointStates, null, 2) }}</pre></ion-card-content></ion-card></div></ion-content></ion-page></template>
<style scoped>pre { white-space:pre-wrap; overflow-wrap:anywhere; font-size:.75rem; }</style>
