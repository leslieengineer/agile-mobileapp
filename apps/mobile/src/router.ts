import { createRouter, createWebHistory } from '@ionic/vue-router'
import { useSessionStore } from '@rhophi/client-sdk'
import LoginView from './views/LoginView.vue'
import TabsView from './views/TabsView.vue'
import HomeView from './views/HomeView.vue'
import DeviceDetailView from './views/DeviceDetailView.vue'
import AddDeviceView from './views/AddDeviceView.vue'
import SettingsView from './views/SettingsView.vue'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/login', component: LoginView, meta: { public: true } },
    {
      path: '/tabs',
      component: TabsView,
      children: [
        { path: '', redirect: '/tabs/home' },
        { path: 'home', component: HomeView },
        { path: 'devices/:nodeId', component: DeviceDetailView },
        { path: 'add', component: AddDeviceView },
        { path: 'settings', component: SettingsView },
      ],
    },
    { path: '/', redirect: '/tabs/home' },
    { path: '/:pathMatch(.*)*', redirect: '/tabs/home' },
  ],
})

router.beforeEach(to => {
  const session = useSessionStore()
  if (!to.meta.public && !session.loading && !session.authenticated) return '/login'
  if (to.path === '/login' && session.authenticated) return '/tabs/home'
})
