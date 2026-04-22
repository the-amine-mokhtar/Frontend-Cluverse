import { Component, Input, OnChanges, SimpleChanges, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

interface RouteInfo {
  distance: string;
  duration: string;
}

interface GeoCoords {
  lat: number;
  lng: number;
}

declare var L: any; // Leaflet global

@Component({
  selector: 'app-transport-map',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="rounded-xl overflow-hidden border border-gray-200 bg-white">
      <!-- Map Container -->
      <div *ngIf="origin && destination" class="w-full">
        <!-- Map Title -->
        <div class="px-6 pt-6 pb-2">
          <h2 class="text-lg font-bold text-gray-800">
            🗺️ Itinéraire: {{ origin }} → {{ destination }}
          </h2>
        </div>

        <!-- Distance & Duration Cards -->
        <div class="p-6 bg-gradient-to-b from-gray-50 to-white grid grid-cols-3 gap-4 items-center">
          <div class="flex-1 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border-l-4 border-blue-600 text-center">
            <div class="text-2xl font-bold text-blue-900">{{ routeInfo.distance }}</div>
            <div class="text-xs font-semibold text-blue-600 uppercase mt-1">Distance</div>
          </div>
          <div class="text-3xl font-bold text-gray-400 text-center">↔️</div>
          <div class="flex-1 bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border-l-4 border-green-600 text-center">
            <div class="text-2xl font-bold text-green-900">{{ routeInfo.duration }}</div>
            <div class="text-xs font-semibold text-green-600 uppercase mt-1">Durée</div>
          </div>
        </div>

        <!-- Map Container -->
        <div #mapContainer class="w-full" style="height: 500px; background: #f0f0f0;">
          <div *ngIf="!mapLoaded" class="w-full h-full flex items-center justify-center bg-gray-100">
            <div class="text-center">
              <div class="text-4xl mb-2">⏳</div>
              <p class="text-gray-600">Chargement de la carte...</p>
            </div>
          </div>
        </div>

        <!-- Route Info Cards -->
        <div class="p-6 bg-white grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border-l-4 border-green-600">
            <div class="text-xs font-semibold text-green-600 uppercase mb-2">📍 Départ</div>
            <div class="text-lg font-bold text-green-900 mb-1">{{ origin }}</div>
            <div *ngIf="originCoords" class="text-xs text-green-700">
              {{ originCoords.lat | number: '1.4-4' }}, {{ originCoords.lng | number: '1.4-4' }}
            </div>
          </div>
          <div class="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border-l-4 border-blue-600">
            <div class="text-xs font-semibold text-blue-600 uppercase mb-2">🎯 Arrivée</div>
            <div class="text-lg font-bold text-blue-900 mb-1">{{ destination }}</div>
            <div *ngIf="destCoords" class="text-xs text-blue-700">
              {{ destCoords.lat | number: '1.4-4' }}, {{ destCoords.lng | number: '1.4-4' }}
            </div>
          </div>
        </div>

        <!-- Full Route Link -->
        <div class="p-4 bg-gradient-to-r from-indigo-600 to-indigo-700">
          <a 
            [href]="directionsUrl"
            target="_blank"
            class="block w-full text-white rounded-lg p-3 text-center font-bold hover:bg-indigo-800 bg-indigo-600/20 transition">
            🗺️ Voir l'itinéraire complet sur OpenStreetMap ↗
          </a>
        </div>
      </div>

      <!-- Empty State -->
      <div *ngIf="!origin || !destination" class="p-6 flex items-center justify-center min-h-48 bg-gray-50 rounded-xl border border-gray-200">
        <div class="text-center">
          <div class="text-4xl mb-2">⚠️</div>
          <p class="text-gray-600 font-semibold">Emplacements non disponibles</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host ::ng-deep {
      .leaflet-container {
        font-family: inherit;
      }
      .leaflet-popup-content-wrapper {
        background: white;
        border-radius: 8px;
      }
      .leaflet-marker-icon {
        filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
      }
    }
  `]
})
export class TransportMapComponent implements OnChanges, AfterViewInit {
  @Input() origin: string = '';
  @Input() destination: string = '';
  @ViewChild('mapContainer') mapContainer!: ElementRef;
  
  directionsUrl: string = '';
  routeInfo: RouteInfo = { distance: '—', duration: '—' };
  originCoords: GeoCoords | null = null;
  destCoords: GeoCoords | null = null;
  mapLoaded = false;
  private map: any = null;

  constructor(private sanitizer: DomSanitizer) {
    this.ensureLeafletLoaded();
  }

  ngAfterViewInit(): void {
    if (this.origin && this.destination) {
      this.initializeMap();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    console.log('[TransportMapComponent] Inputs changed:', { origin: this.origin, destination: this.destination });
    if (this.origin && this.destination && this.mapContainer) {
      this.initializeMap();
    }
  }

  private ensureLeafletLoaded(): void {
    if (typeof L === 'undefined') {
      console.warn('[TransportMapComponent] Leaflet not loaded yet');
    }
  }

  private async initializeMap(): Promise<void> {
    try {
      console.log('[TransportMapComponent] Initializing map with:', { origin: this.origin, destination: this.destination });
      
      // Geocode both addresses
      this.originCoords = await this.geocodeAddress(this.origin);
      this.destCoords = await this.geocodeAddress(this.destination);

      console.log('[TransportMapComponent] Geocoding complete:', { originCoords: this.originCoords, destCoords: this.destCoords });

      if (this.originCoords && this.destCoords) {
        this.createDirectionsUrl();
        this.calculateDistance();
        
        // Display map after a short delay to ensure DOM is ready
        setTimeout(() => {
          this.renderLeafletMap();
        }, 100);
      }
    } catch (err) {
      console.error('[TransportMapComponent] Error initializing map:', err);
    }
  }

  private async geocodeAddress(address: string): Promise<GeoCoords | null> {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        address + ', Tunisie'
      )}&limit=1`;

      console.log('[TransportMapComponent] Geocoding address:', { address, url });

      const response = await fetch(url);
      const data: any[] = await response.json();

      console.log('[TransportMapComponent] Geocoding response:', { address, data });

      if (data && data.length > 0) {
        const coords = {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon)
        };
        console.log('[TransportMapComponent] Geocoding success:', { address, coords });
        return coords;
      }
      console.log('[TransportMapComponent] Geocoding no results:', { address });
      return null;
    } catch (err) {
      console.error('[TransportMapComponent] Geocoding error:', { address, err });
      return null;
    }
  }

  private renderLeafletMap(): void {
    if (!this.originCoords || !this.destCoords || !this.mapContainer) {
      console.error('[TransportMapComponent] Missing coordinates or map container');
      return;
    }

    try {
      if (typeof L === 'undefined') {
        console.error('[TransportMapComponent] Leaflet library not loaded');
        return;
      }

      // Calculate center point
      const centerLat = (this.originCoords.lat + this.destCoords.lat) / 2;
      const centerLng = (this.originCoords.lng + this.destCoords.lng) / 2;

      // Initialize map if not already done
      if (!this.map) {
        this.map = L.map(this.mapContainer.nativeElement).setView([centerLat, centerLng], 10);

        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(this.map);

        console.log('[TransportMapComponent] Map initialized');
      }

      // Clear existing markers and polylines
      this.map.eachLayer((layer: any) => {
        if (layer instanceof L.Marker || layer instanceof L.Polyline) {
          this.map.removeLayer(layer);
        }
      });

      // Add origin marker (green)
      L.marker([this.originCoords.lat, this.originCoords.lng], {
        icon: L.icon({
          iconUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2322c55e" width="32" height="32"><path d="M12 0C7.04 0 3 4.04 3 9c0 5.25 9 15 9 15s9-9.75 9-15c0-4.96-4.04-9-9-9zm0 12c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/></svg>',
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -32]
        })
      }).addTo(this.map).bindPopup(`<strong>${this.origin}</strong><br/>Départ`);

      // Add destination marker (red)
      L.marker([this.destCoords.lat, this.destCoords.lng], {
        icon: L.icon({
          iconUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ef4444" width="32" height="32"><path d="M12 0C7.04 0 3 4.04 3 9c0 5.25 9 15 9 15s9-9.75 9-15c0-4.96-4.04-9-9-9zm0 12c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/></svg>',
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -32]
        })
      }).addTo(this.map).bindPopup(`<strong>${this.destination}</strong><br/>Arrivée`);

      // Add route line
      const routeLine = L.polyline([
        [this.originCoords.lat, this.originCoords.lng],
        [this.destCoords.lat, this.destCoords.lng]
      ], {
        color: '#4f46e5',
        weight: 4,
        opacity: 0.8,
        dashArray: undefined
      }).addTo(this.map);

      // Fit map to bounds
      const bounds = L.latLngBounds([
        [this.originCoords.lat, this.originCoords.lng],
        [this.destCoords.lat, this.destCoords.lng]
      ]);
      this.map.fitBounds(bounds, { padding: [50, 50] });

      // Trigger resize to ensure proper rendering
      setTimeout(() => {
        this.map.invalidateSize();
        this.mapLoaded = true;
        console.log('[TransportMapComponent] Map rendered successfully');
      }, 200);

    } catch (err) {
      console.error('[TransportMapComponent] Error rendering map:', err);
    }
  }

  private createDirectionsUrl(): void {
    if (!this.originCoords || !this.destCoords) return;

    const encodedOrigin = encodeURIComponent(this.origin + ', Tunisie');
    const encodedDest = encodeURIComponent(this.destination + ', Tunisie');
    this.directionsUrl = `https://www.openstreetmap.org/directions?engine=osrm_car&route=${encodedOrigin};${encodedDest}`;
  }

  private calculateDistance(): void {
    if (!this.originCoords || !this.destCoords) return;

    // Haversine formula
    const R = 6371; // Earth radius in km
    const dLat = ((this.destCoords.lat - this.originCoords.lat) * Math.PI) / 180;
    const dLng = ((this.destCoords.lng - this.originCoords.lng) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((this.originCoords.lat * Math.PI) / 180) *
        Math.cos((this.destCoords.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    // Estimate duration at 50 km/h
    const durationHours = distance / 50;
    const hours = Math.floor(durationHours);
    const minutes = Math.round((durationHours - hours) * 60);

    this.routeInfo = {
      distance: distance.toFixed(1) + ' km',
      duration: hours > 0 ? `${hours}h ${minutes}m` : `${minutes} min`
    };

    console.log('[TransportMapComponent] Distance calculated:', this.routeInfo);
  }
}
