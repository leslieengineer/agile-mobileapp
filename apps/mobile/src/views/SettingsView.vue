<script setup lang="ts">
import { IonButton, IonCard, IonCardContent, IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/vue'
import { useSessionStore } from '@rhophi/client-sdk'
import { api } from '../services/api'
import { stopRealtime } from '../services/realtime'
import { router } from '../router'
const session = useSessionStore()
async function logout(){try{await api.logout()}finally{stopRealtime();session.clear();await router.replace('/login')}}
</script>
<template><ion-page><ion-header><ion-toolbar><ion-title>Settings</ion-title></ion-toolbar></ion-header><ion-content><div class="page"><ion-card><ion-card-content><h2>{{ session.username }}</h2><p class="muted">Session token is encrypted by Android Keystore on device.</p><ion-button expand="block" color="danger" fill="outline" @click="logout">Sign out</ion-button></ion-card-content></ion-card></div></ion-content></ion-page></template>
