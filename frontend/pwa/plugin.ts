import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { serviceWorkerSource } from './serviceWorker';

export function pwaPlugin(): Plugin {
  let root = '';
  return {
    name: 'jardim-pwa', apply: 'build',
    configResolved(config) { root = config.root; },
    generateBundle(_options, bundle) {
      const staticAssets = ['/offline.html', '/manifest.webmanifest', '/pwa/icon-192.png', '/pwa/icon-512.png', '/pwa/icon-maskable-512.png', '/pwa/apple-touch-icon.png', '/pwa/favicon-32.png', '/pwa/favicon-48.png'];
      const built = Object.keys(bundle).filter(name => /\.(js|css)$/.test(name)).map(name => `/${name}`);
      const hash = createHash('sha256').update(built.join('\n'));
      staticAssets.forEach(name => hash.update(readFileSync(resolve(root, 'public', name.slice(1)))));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: serviceWorkerSource(hash.digest('hex').slice(0, 16), [...staticAssets, ...built]) });
    },
  };
}
