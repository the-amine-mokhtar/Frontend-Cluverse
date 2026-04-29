import { Injectable } from '@angular/core';
import * as Cesium from 'cesium';
import { EventItem } from './event-api.service';


@Injectable({
  providedIn: 'root'
})
export class CesiumMapService {

  viewer!: Cesium.Viewer;

  // 🔥 IMPORTANT : async
  
  async initMap(container: HTMLElement) {
    if (typeof WebGLRenderingContext === 'undefined') {
      throw new Error('WebGL n’est pas supporté par ce navigateur. Utilisez un navigateur compatible WebGL.');
    }

    // Disable Cesium Ion default warnings when not using Ion assets.
    if (Cesium.Ion && 'defaultAccessToken' in Cesium.Ion) {
      Cesium.Ion.defaultAccessToken = '';
    }

    const terrainProvider = new Cesium.EllipsoidTerrainProvider();
    const imageryProvider = new Cesium.OpenStreetMapImageryProvider({
      url: 'https://a.tile.openstreetmap.org/'
    });

    this.viewer = new Cesium.Viewer(container, {
      baseLayer: new Cesium.ImageryLayer(imageryProvider, {}),
      terrainProvider,
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      infoBox: false,
      selectionIndicator: false,
      scene3DOnly: true
    });
  }

  async addBuildings(): Promise<void> {
    // Skip Cesium Ion 3D buildings by default so the map works without an Ion token.
    // If you want buildings, provide a valid Cesium Ion access token and asset id.
    return Promise.resolve();
  }

  addEvent(event: EventItem): void {
    const lat = parseFloat(event.locationLatitude || '36.8');
    const lng = parseFloat(event.locationLongitude || '10.2');

    this.viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lng, lat),
      billboard: {
        image: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
        scale: 0.05
      },
      description: this.createPopup(event)
    });
  }

  private createPopup(event: EventItem): string {
    return `
      <div style="font-family: Arial; padding:10px;">
        <h3>${event.title}</h3>
        <p>📅 ${new Date(event.startDate).toLocaleDateString()}</p>
        <p>👥 ${event.participantsCount || 0} / ${event.capacity || 0}</p>
        <p>📊 ${event.status || 'N/A'}</p>
      </div>
    `;
  }

  flyTo(lat: number, lng: number): void {
    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lng, lat, 2000)
    });
  }

  destroy(): void {
    if (this.viewer) {
      this.viewer.destroy();
    }
  }
}
