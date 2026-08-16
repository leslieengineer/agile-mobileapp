<script setup lang="ts">
import { IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from '@ionic/vue'
import { addCircleOutline, homeOutline, settingsOutline } from 'ionicons/icons'
</script>

<template>
  <ion-tabs>
    <ion-router-outlet />
    <ion-tab-bar slot="bottom">
      <ion-tab-button tab="home" href="/tabs/home"><ion-icon :icon="homeOutline" /><ion-label>Home</ion-label></ion-tab-button>
      <ion-tab-button tab="add" href="/tabs/add"><ion-icon :icon="addCircleOutline" /><ion-label>Add Device</ion-label></ion-tab-button>
      <ion-tab-button tab="settings" href="/tabs/settings"><ion-icon :icon="settingsOutline" /><ion-label>Settings</ion-label></ion-tab-button>
    </ion-tab-bar>
  </ion-tabs>
</template>
