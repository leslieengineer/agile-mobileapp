import { registerPlugin } from '@capacitor/core'
import type { RhophiCommissioningPlugin } from './definitions.js'

export const RhophiCommissioning = registerPlugin<RhophiCommissioningPlugin>('RhophiCommissioning')
export * from './definitions.js'
