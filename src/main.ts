// Polyfill for crypto.randomUUID in insecure contexts (HTTP)
if (typeof window !== 'undefined' && window.crypto && !window.crypto.randomUUID) {
  (window.crypto as any).randomUUID = function() {
    return (([1e7] as any) + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c: any) =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
  };
}

import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';
import * as L from 'leaflet';

// Fix Leaflet default icon paths to point to node_modules bundled images
try {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'assets/leaflet/marker-icon-2x.png',
    iconUrl: 'assets/leaflet/marker-icon.png',
    shadowUrl: 'assets/leaflet/marker-shadow.png',
  });
} catch (e) {
  // Leaflet may not be fully loaded yet; icons will fall back to divIcon in components
  console.debug('Leaflet icon initialization skipped', e);
}

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch((err) => console.error(err));
