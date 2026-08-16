<script setup lang="ts">
import { IonBadge } from '@ionic/vue'
import { useConnectionStore } from '@rhophi/client-sdk'
const connection = useConnectionStore()
</script>
<template><ion-badge :color="connection.connected ? 'success' : connection.connecting ? 'warning' : 'danger'">{{ connection.connected ? 'Live' : connection.connecting ? 'Connecting' : 'Offline' }}</ion-badge></template>
