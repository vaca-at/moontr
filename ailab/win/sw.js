// AI 연구소 비서 (윈도우 앱) 서비스 워커: 설치 가능하게 + 알림을 누르면 비서 창을 앞으로 (2026-11-18)
// 파일을 저장해 두지 않아요 (늘 최신 화면을 받아요)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const w = list.find((c) => c.url.includes('/ailab/win/'));
    return w ? w.focus() : self.clients.openWindow('/ailab/win/');
  }));
});
