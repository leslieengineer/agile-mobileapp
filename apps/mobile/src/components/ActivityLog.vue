<script setup lang="ts">
import { IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonItem, IonLabel, IonList } from '@ionic/vue'
import { useActivityStore } from '@rhophi/client-sdk'
const activity = useActivityStore()
</script>
<template>
  <ion-card><ion-card-header><ion-card-title>Activity</ion-card-title></ion-card-header><ion-card-content>
    <p v-if="!activity.items.length" class="muted">No realtime activity yet.</p>
    <ion-list v-else lines="full"><ion-item v-for="(item,index) in activity.items" :key="`${item.timestamp}-${index}`"><ion-label><h3>Node {{ item.node_id ?? 'gateway' }}</h3><p>Endpoint {{ item.endpoint ?? '—' }} · Cluster {{ item.cluster ?? '—' }} · {{ 'status' in item ? item.status : 'event' }}</p></ion-label></ion-item></ion-list>
  </ion-card-content></ion-card>
</template>
