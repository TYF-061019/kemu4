// 全国交通票务查询平台 Service Worker
// 缓存策略：核心文件 cache-first，外部 CDN 资源 network-first 回退 cache

const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `transport-platform-${CACHE_VERSION}`;
const CORE_ASSETS = [
  './',
  './transport-platform.html',
  './manifest.json',
  './icon.svg',
  './icon-maskable.svg'
];

// 安装：预缓存核心文件
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// 激活：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// 拦截请求
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 跨域请求（OpenStreetMap 瓦片、Leaflet CDN）走 network-first，回退缓存
  if (url.origin !== location.origin) {
    event.respondWith(
      fetch(req).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match(req).then(r => r || new Response('', { status: 504 })))
    );
    return;
  }

  // 同源核心文件 cache-first
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match('./transport-platform.html'));
    })
  );
});

// 支持从主页面触发更新
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
