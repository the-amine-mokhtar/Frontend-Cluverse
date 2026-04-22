import { Component, Input, Output, EventEmitter, AfterViewInit, OnDestroy } from '@angular/core';
import { EventItem } from '../../services/event-api.service';
import * as L from 'leaflet';

@Component({
  selector: 'app-event-map-3d',
  template: `
    <div class="map-container">
      <div id="event-map" class="map"></div>
    </div>
  `,
  styles: [`
    .map-container {
      width: 100%;
      height: 400px;
      border-radius: 12px;
      overflow: hidden;
    }
    .map {
      width: 100%;
      height: 100%;
    }
  `]
})
export class EventMap3DComponent implements AfterViewInit, OnDestroy {
  @Input() events: EventItem[] = [];
  @Input() zoom: number = 15;
  @Input() mode: 'view' | 'select' = 'view';
  @Output() locationSelected = new EventEmitter<{lat: number, lng: number}>();

  private map: L.Map | undefined;
  private marker: L.Marker | undefined;

  constructor() {}

  ngAfterViewInit(): void {
    setTimeout(() => {
      if (this.events.length > 0) {
        const hasCoordinates = this.events.some(e => e.locationLatitude && e.locationLongitude);
        if (hasCoordinates) {
          this.initMap();
        } else {
          this.initMapWithoutCoordinates();
        }
      } else if (this.mode === 'select') {
        this.initMapForSelection();
      }
    }, 100);
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  private initMap(): void {
    // Find first event with coordinates for centering
    const eventWithCoords = this.events.find(e => e.locationLatitude && e.locationLongitude);
    const centerLat = parseFloat(eventWithCoords?.locationLatitude || '36.8');
    const centerLng = parseFloat(eventWithCoords?.locationLongitude || '10.2');

    // Initialize map with terrain tiles
    this.map = L.map('event-map', {
      center: [centerLat, centerLng],
      zoom: this.zoom,
      zoomControl: true,
      scrollWheelZoom: true
    });

    // Add OpenTopoMap for terrain view
    L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
    }).addTo(this.map!);

    // Add markers for all events
    this.events.forEach(event => {
      if (event.locationLatitude && event.locationLongitude) {
        this.createEventMarker(event);
      } else {
        // Event without coordinates - show default marker
        L.marker([36.8, 10.2], { opacity: 0.7 }).addTo(this.map!)
          .bindPopup(`<b>${event.title}</b><br><i>📍 Localisation non spécifiée</i><br>${event.locationName || 'Adresse non disponible'}`);
      }
    });
  }

  private initMapWithoutCoordinates(): void {
    // Initialize map with default center (Tunisia)
    this.map = L.map('event-map', {
      center: [36.8, 10.2], // Default to Tunisia
      zoom: this.zoom,
      zoomControl: true,
      scrollWheelZoom: true
    });

    // Add OpenTopoMap for terrain view
    L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
    }).addTo(this.map!);

    // Add markers for all events
    this.events.forEach(event => {
      if (event.locationLatitude && event.locationLongitude) {
        this.createEventMarker(event);
      } else {
        // Event without coordinates - show default marker
        L.marker([36.8, 10.2], { opacity: 0.7 }).addTo(this.map!)
          .bindPopup(`<b>${event.title}</b><br><i>📍 Localisation non spécifiée</i><br>${event.locationName || 'Adresse non disponible'}`);
      }
    });
  }

  private initMapForSelection(): void {
    // Initialize map with default center (e.g., Tunisia)
    this.map = L.map('event-map', {
      center: [36.8, 10.2], // Default to Tunisia
      zoom: 7,
      zoomControl: true,
      scrollWheelZoom: true
    });

    // Add OpenTopoMap for terrain view
    L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
    }).addTo(this.map!);

    // Add click handler for location selection
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      this.locationSelected.emit({ lat, lng });

      // Update or add marker
      if (this.marker) {
        this.marker.setLatLng([lat, lng]);
      } else {
        this.marker = L.marker([lat, lng]).addTo(this.map!);
      }
      this.marker.bindPopup(`Selected location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`).openPopup();
    });
  }

  private createEventMarker(event: EventItem): void {
    if (!event.locationLatitude || !event.locationLongitude) return;

    // Create default icon
    const customIcon = L.divIcon({
      html: `<div style="background-color: #2196F3; border-radius: 50%; width: 20px; height: 20px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
      className: 'custom-event-marker',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    const marker = L.marker([parseFloat(event.locationLatitude), parseFloat(event.locationLongitude)], { icon: customIcon }).addTo(this.map!);

    // Create simple popup
    const popupContent = `<b>${event.title}</b><br>${event.locationName || ''}`;
    marker.bindPopup(popupContent);
  }
}