import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'uk.rhophi.mobile',
  appName: 'Rhophi',
  webDir: 'dist',
  server: { androidScheme: 'https', cleartext: false },
}

export default config
