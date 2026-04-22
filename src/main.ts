import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';
import 'leaflet/dist/leaflet.css';
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
