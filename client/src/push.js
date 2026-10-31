// Installable app + Web Push. The service worker (public/sw.js) shows the notifications; the server decides
// what to send (server/src/push.js). On iPhone push works only in the app added to the home screen (iOS 16.4+).
import { api } from './api.js';
import { getLang } from './i18n.js';

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch(() => {});
  // a tapped notification while the app is open: go to its tile
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type !== 'open') return;
    const id = new URL(e.data.url, location.origin).searchParams.get('w');
    if (id) window.dispatchEvent(new CustomEvent('nexus:reveal', { detail: { id } }));
  });
}

const toBytes = (b64) => {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

// Must run from a tap (iOS asks for permission only then).
export async function enablePush() {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw Object.assign(new Error('denied'), { denied: true });
  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('/sw.js'));
  await navigator.serviceWorker.ready;
  const { publicKey } = await api.get('/push/key');
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(publicKey) });
  await api.post('/push/subscribe', { subscription: sub.toJSON(), lang: getLang() });
  return sub;
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  await api.post('/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

export async function testPush() {
  const sub = await currentSubscription();
  return api.post('/push/test', { endpoint: sub?.endpoint, lang: getLang() });
}
