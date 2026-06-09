const fs = require('fs');
const path = require('path');

const pkg = require('../package.json');
const buildId = process.env.BUILD_ID || `${pkg.version}-${Date.now()}`;
const publicDir = path.join(__dirname, '..', 'public');

const versionPayload = {
  version: pkg.version,
  buildId,
  builtAt: new Date().toISOString(),
};

fs.writeFileSync(
  path.join(publicDir, 'version.json'),
  JSON.stringify(versionPayload, null, 2)
);

const swSource = `/* CatIntAssist service worker — build ${buildId} */
const BUILD_ID = '${buildId}';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
`;

fs.writeFileSync(path.join(publicDir, 'sw.js'), swSource);

console.log('[prebuild] version.json + sw.js →', buildId);
