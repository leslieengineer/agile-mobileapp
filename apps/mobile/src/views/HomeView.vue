<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { IonContent, IonHeader, IonItem, IonLabel, IonList, IonPage, IonTitle, IonToolbar } from '@ionic/vue'
import { ApiDeviceCatalog, type DeviceDescriptor } from '@rhophi/client-sdk'
import { commissioningApi } from '../services/api'
import ActivityLog from '../components/ActivityLog.vue'
import ConnectionBadge from '../components/ConnectionBadge.vue'
import CooktopPanel from '../components/CooktopPanel.vue'
import LevelSlider from '../components/LevelSlider.vue'
import OnOffCard from '../components/OnOffCard.vue'
import WindowCoveringCard from '../components/WindowCoveringCard.vue'

const devices = ref<DeviceDescriptor[]>([])
const catalog = new ApiDeviceCatalog(commissioningApi)
onMounted(async () => devices.value = await catalog.list())
</script>
<template><ion-page><ion-header><ion-toolbar><ion-title>Home</ion-title><connection-badge slot="end" style="margin-right:16px" /></ion-toolbar></ion-header><ion-content><div class="page"><p class="eyebrow">Matter over Thread</p><h1>Your devices</h1><ion-list inset><ion-item v-for="device in devices" :key="device.nodeId" button :router-link="`/tabs/devices/${encodeURIComponent(device.nodeId)}`"><ion-label><h2>{{ device.name }}</h2><p>{{ device.product }} · {{ device.nodeId }}</p></ion-label></ion-item></ion-list><div v-for="device in devices" :key="`${device.nodeId}-controls`" class="card-grid"><template v-for="endpoint in device.endpoints" :key="`${endpoint.endpoint}-${endpoint.kind}`"><on-off-card v-if="endpoint.kind === 'onoff'" :node-id="device.nodeId" :endpoint="endpoint.endpoint"/><level-slider v-else-if="endpoint.kind === 'level'" :node-id="device.nodeId" :endpoint="endpoint.endpoint"/><window-covering-card v-else-if="endpoint.kind === 'window-covering'" :node-id="device.nodeId" :endpoint="endpoint.endpoint"/><cooktop-panel v-else :node-id="device.nodeId" :endpoint="endpoint.endpoint"/></template></div><activity-log /></div></ion-content></ion-page></template>
