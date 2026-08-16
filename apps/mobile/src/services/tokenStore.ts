import { Capacitor, registerPlugin } from '@capacitor/core'
import type { TokenProvider } from '@rhophi/client-sdk'

interface SecureSessionPlugin {
  setToken(options: { token: string }): Promise<void>
  getToken(): Promise<{ token?: string }>
  clearToken(): Promise<void>
}

const nativeSecureSession = registerPlugin<SecureSessionPlugin>('SecureSession')
let memoryToken: string | undefined

export const tokenStore: TokenProvider = {
  async get() {
    if (!Capacitor.isNativePlatform()) return memoryToken
    return (await nativeSecureSession.getToken()).token
  },
  async set(token: string) {
    if (!Capacitor.isNativePlatform()) {
      memoryToken = token
      return
    }
    await nativeSecureSession.setToken({ token })
  },
  async clear() {
    if (!Capacitor.isNativePlatform()) {
      memoryToken = undefined
      return
    }
    await nativeSecureSession.clearToken()
  },
}
