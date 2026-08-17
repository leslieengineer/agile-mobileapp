<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { IonButton, IonCard, IonCardContent, IonContent, IonHeader, IonItem, IonLabel, IonList, IonPage, IonSelect, IonSelectOption, IonSpinner, IonTitle, IonToolbar } from '@ionic/vue'
import { isFailure, type CommissioningFailureState } from '@rhophi/client-sdk'
import { useCommissioningStore } from '../stores/commissioning'

const commissioning = useCommissioningStore()
onMounted(() => void commissioning.resume())
const failureOptions: CommissioningFailureState[] = ['CLAIM_FAILED','PASE_FAILED','ATTESTATION_FAILED','THREAD_ATTACH_FAILED','BBB_COMMISSION_FAILED','SUBSCRIPTION_FAILED','TEMP_FABRIC_REMOVE_FAILED']
const phase = computed(() => {
  const state = commissioning.state
  if (isFailure(state)) return 'recovery'
  if (state === 'CREATED') return 'prepare'
  if (state === 'BLE_SCANNING') return commissioning.devices.length ? 'select' : 'searching'
  if (state === 'DEVICE_SELECTED' || state === 'IDENTIFYING') return 'identify'
  if (state === 'CLAIM_CHALLENGE' || state === 'CLAIM_VERIFIED' || state === 'GRANT_ISSUED') return 'verify'
  if (['BLE_CONNECTING','PASE_ESTABLISHED','ATTESTATION_VERIFIED','THREAD_PROVISIONING'].includes(state)) return 'thread'
  if (['THREAD_ATTACHING','TEMP_FABRIC_COMMISSIONED'].includes(state)) return 'attaching'
  if (['WINDOW_OPEN','BBB_FABRIC_COMMISSIONING'].includes(state)) return 'gateway'
  if (['ENDPOINT_DISCOVERY','SUBSCRIBING'].includes(state)) return 'capabilities'
  if (state === 'TEMP_FABRIC_REMOVING' || state === 'CLEANUP_PENDING') return 'cleanup'
  return 'complete'
})
</script>

<template><ion-page><ion-header><ion-toolbar><ion-title>Add Device (Bypass)</ion-title></ion-toolbar></ion-header><ion-content>
  <div v-if="commissioning.mock" class="mock-banner">Development simulation · No BLE or Matter operation is performed</div>
  <div class="page">
    <ion-card v-if="!commissioning.available"><ion-card-content><h2>Commissioning unavailable</h2><p class="muted">Provisioning requires the signed native Android build.</p></ion-card-content></ion-card>
    <template v-else>
      <ion-card><ion-card-content><p class="eyebrow">State {{ commissioning.state }}</p>
        <template v-if="phase === 'prepare'"><h2>Prepare device</h2><p>Hold the device button for 5 seconds until the status indicator flashes blue.</p><ion-button expand="block" @click="commissioning.scan">Search nearby devices</ion-button></template>
        <template v-else-if="phase === 'searching'"><h2>Searching</h2><p class="muted">Looking for nearby commissionable Rhophi devices.</p><ion-spinner /></template>
        <template v-else-if="phase === 'select'"><h2>Select device</h2><ion-list><ion-item v-for="device in commissioning.devices" :key="device.claimId" button @click="commissioning.select(device)"><ion-label><h3>{{ device.productName }}</h3><p>Serial …{{ device.serialSuffix }} · Signal {{ device.rssi }} dBm</p></ion-label></ion-item></ion-list></template>
        <template v-else-if="phase === 'identify'"><h2>Identify</h2><p>Confirming the selected device by its indicator pattern.</p><ion-spinner /></template>
        <template v-else-if="phase === 'verify'"><h2>Verify ownership</h2><p>The device proof is verified by the gateway before Matter credentials are released.</p><ion-button expand="block" :disabled="commissioning.running" @click="commissioning.commission">Commission device</ion-button></template>
        <template v-else-if="phase === 'thread'"><h2>Configuring Thread</h2><p>Establishing the commissioning session and verifying attestation.</p><ion-spinner /></template>
        <template v-else-if="phase === 'attaching'"><h2>Joining Thread network</h2><p>Waiting for the device to attach.</p><ion-spinner /></template>
        <template v-else-if="phase === 'gateway'"><h2>Adding to Gateway</h2><p>Opening a temporary window and handing off to the permanent fabric.</p><ion-spinner /></template>
        <template v-else-if="phase === 'capabilities'"><h2>Reading capabilities</h2><p>Discovering endpoints and subscriptions.</p><ion-spinner /></template>
        <template v-else-if="phase === 'cleanup'"><h2>Finalizing ownership</h2><p v-if="commissioning.state === 'CLEANUP_PENDING'" class="error">The BBB fabric is operational, but temporary mobile-fabric cleanup must be retried.</p><ion-spinner v-else /><ion-button v-if="commissioning.state === 'CLEANUP_PENDING'" expand="block" @click="commissioning.retry">Retry cleanup</ion-button></template>
        <template v-else-if="phase === 'complete'"><h2>Complete</h2><p>The permanent BBB fabric is operational and the temporary mobile fabric was removed.</p><ion-button expand="block" @click="commissioning.reset">Done</ion-button></template>
        <template v-else><h2>Recovery</h2><p class="error">{{ commissioning.error || commissioning.state }}</p><ion-button v-if="commissioning.retryable" expand="block" @click="commissioning.retry">Restart safely</ion-button><ion-button expand="block" fill="outline" @click="commissioning.reset">Cancel</ion-button></template>
      </ion-card-content></ion-card>
      <ion-card v-if="phase === 'prepare' && commissioning.mock"><ion-card-content><h3>Development failure injection</h3><ion-select v-model="commissioning.failureAt" label="Failure point" label-placement="stacked"><ion-select-option value="">None</ion-select-option><ion-select-option v-for="failure in failureOptions" :key="failure" :value="failure">{{ failure }}</ion-select-option></ion-select></ion-card-content></ion-card>
      <ion-button v-if="commissioning.running && !['searching','identify','thread','attaching','gateway','capabilities'].includes(phase)" fill="clear" color="medium" @click="commissioning.cancel">Cancel</ion-button>
    </template>
  </div>
</ion-content></ion-page></template>
