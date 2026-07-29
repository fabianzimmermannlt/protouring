// Web-Push im Browser: Permission anfragen, abonnieren, abmelden.
import { getVapidPublicKey, savePushSubscription, deletePushSubscription } from '@/lib/api-client'

export type PushState = 'unsupported' | 'denied' | 'default' | 'subscribed' | 'unsubscribed'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

// Aktuellen Zustand ermitteln (ohne etwas zu ändern).
export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) return 'subscribed'
  } catch { /* ignore */ }
  return Notification.permission === 'granted' ? 'unsubscribed' : 'default'
}

// Aktiviert Push auf diesem Gerät: fragt Permission, abonniert, meldet an den Server.
export async function enablePush(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported'
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'default'

  const { key, enabled } = await getVapidPublicKey()
  if (!enabled || !key) throw new Error('Push ist serverseitig nicht aktiv.')

  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
    })
  }
  await savePushSubscription(sub.toJSON())
  return 'subscribed'
}

// Deaktiviert Push auf diesem Gerät.
export async function disablePush(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported'
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await deletePushSubscription(sub.endpoint)
      await sub.unsubscribe()
    }
  } catch { /* ignore */ }
  return Notification.permission === 'granted' ? 'unsubscribed' : 'default'
}
