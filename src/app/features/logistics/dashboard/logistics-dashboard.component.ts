import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { defaultIfEmpty } from 'rxjs/operators';

import { ResourceService } from '../services/resource.service';
import { VehicleService } from '../services/vehicle.service';
import { TransportService } from '../services/transport.service';
import { LogisticsApiService, LocationItem } from '../services/logistics-api.service';
import { MaintenanceService, MaintenancePredictionResponse } from '../services/maintenance.service';

import { Resource } from '../models/resource.model';
import { Vehicle } from '../models/vehicle.model';
import { Transport } from '../models/transport.model';

import {
  RESOURCE_STATUS_LABELS,
  TRANSPORT_STATUS_LABELS,
  getStatusBadgeClasses
} from '../utils/status-labels';

@Component({
  selector: 'app-logistics-dashboard',
  templateUrl: './logistics-dashboard.component.html',
  styleUrls: ['./logistics-dashboard.component.scss']
})
export class LogisticsDashboardComponent implements OnInit, OnDestroy {
  loading = false;
  errorMessage: string | null = null;

  clubId = 0;

  resources: Resource[] = [];
  vehicles: Vehicle[] = [];
  transports: Transport[] = [];
  locations: LocationItem[] = [];

  lowStockResources: Resource[] = [];
  upcomingTransports: Transport[] = [];
  vehiclesAtRisk: MaintenancePredictionResponse[] = [];

  currentTransportPage = 1;
  readonly transportsPerPage = 4;

  kpiTotalResources = 0;
  kpiLowStockResources = 0;
  kpiAvailableVehicles = 0;
  kpiVehiclesAtRiskThisWeek = 0;
  kpiTotalTransports = 0;
  kpiTransportsPlanned = 0;

  voiceSupported = false;
  voiceListening = false;
  voiceTranscript = '';
  voiceAssistantMessage = 'Prêt à recevoir vos commandes vocales.';

  private recognition: any | null = null;
  private lastExecutedVoiceCommand = '';
  private lastExecutedAt = 0;

  readonly resourceStatusLabels = RESOURCE_STATUS_LABELS;
  readonly transportStatusLabels = TRANSPORT_STATUS_LABELS;
  readonly getStatusBadgeClasses = getStatusBadgeClasses;

  constructor(
    private router: Router,
    private resourceService: ResourceService,
    private vehicleService: VehicleService,
    private transportService: TransportService,
    private logisticsApi: LogisticsApiService,
    private maintenanceService: MaintenanceService
  ) {}

  ngOnInit(): void {
    const storedClubId = Number(localStorage.getItem('clubId') ?? 0);
    this.clubId = Number.isFinite(storedClubId) ? storedClubId : 0;
    this.voiceSupported = !!this.getSpeechRecognitionConstructor();

    this.loading = true;
    this.errorMessage = null;

    // First, update all transport statuses automatically
    this.transportService.updateAllStatuses().subscribe({
      next: () => {
        // Then load the current data
        this.loadDashboard();
      },
      error: (error) => {
        console.error('[LogisticsDashboardComponent] updateAllStatuses failed', error);
        // Continue loading even if update fails
        this.loadDashboard();
      }
    });
  }

  ngOnDestroy(): void {
    this.stopVoiceListening();
  }

  private loadDashboard(): void {
    forkJoin({
      resources: this.resourceService.getAll(this.clubId),
      vehicles: this.vehicleService.getAll(),
      transports: this.transportService.getAll(),
      locations: this.logisticsApi.getLocations().pipe(defaultIfEmpty([] as LocationItem[])),
      vehiclesAtRisk: this.maintenanceService.getVehiclesAtRisk().pipe(defaultIfEmpty([] as MaintenancePredictionResponse[]))
    }).subscribe({
      next: ({ resources, vehicles, transports, locations, vehiclesAtRisk }) => {
        this.resources = resources;
        this.vehicles = vehicles;
        this.transports = transports;
        this.locations = Array.isArray(locations) ? locations : [];
        this.vehiclesAtRisk = Array.isArray(vehiclesAtRisk) ? vehiclesAtRisk : [];

        this.lowStockResources = this.resources.filter(
          (r) => Number(r.availableQuantity) <= Number(r.lowStockThreshold)
        );

        const now = new Date().getTime();
        this.upcomingTransports = this.transports
          .filter((t) => {
            // Exclure les transports passés
            if (this.toTime(t.scheduledDate) < now) {
              return false;
            }
            return t.status === 'PLANNED' || t.status === 'IN_PROGRESS';
          })
          .sort((a, b) => this.toTime(a.scheduledDate) - this.toTime(b.scheduledDate))
          .slice(0, 5);

        this.kpiTotalResources = this.resources.length;
        this.kpiLowStockResources = this.lowStockResources.length;
        this.kpiAvailableVehicles = this.vehicles.filter((v) => v.available === true).length;
        this.kpiVehiclesAtRiskThisWeek = this.vehiclesAtRisk.filter((v) => v.riskLevel !== 'GOOD').length;
        this.kpiTotalTransports = this.transports.length;
        this.kpiTransportsPlanned = this.transports.filter((t) => t.status === 'PLANNED').length;

        this.loading = false;
      },
      error: (error) => {
        console.error('[LogisticsDashboardComponent] load failed', error);
        this.errorMessage = 'Impossible de charger le dashboard logistique.';
        this.loading = false;
      }
    });
  }

  private toTime(value: unknown): number {
    if (!value) {
      return Number.POSITIVE_INFINITY;
    }

    const text = String(value).trim();
    if (!text) {
      return Number.POSITIVE_INFINITY;
    }

    const time = new Date(text).getTime();
    return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
  }

  private isInCurrentIsoWeek(value: unknown): boolean {
    const time = this.toTime(value);
    if (!Number.isFinite(time)) {
      return false;
    }

    const target = new Date(time);
    const now = new Date();

    const start = this.startOfIsoWeek(now);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    return target >= start && target < end;
  }

  private startOfIsoWeek(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);

    // ISO week starts Monday. JS getDay(): 0=Sun,1=Mon,...
    const day = d.getDay();
    const diffToMonday = (day + 6) % 7;
    d.setDate(d.getDate() - diffToMonday);
    return d;
  }

  getVehicleLabel(vehicleId: number | string | undefined): string {
    const id = Number(vehicleId ?? 0);
    if (!id) {
      return 'Véhicule inconnu';
    }

    const vehicle = this.vehicles.find((v) => Number(v.id) === id);
    if (!vehicle) {
      return `Véhicule #${id}`;
    }

    const plate = String(vehicle.plateNumber ?? '').trim();
    const model = String(vehicle.model ?? '').trim();

    if (plate && model) {
      return `${plate} — ${model}`;
    }
    if (plate) {
      return plate;
    }
    if (model) {
      return model;
    }

    return `Véhicule #${id}`;
  }

  locationText(locationId: number | null): string {
    const id = Number(locationId ?? 0);
    if (!id) {
      return '—';
    }
    const found = this.locations.find((l) => Number(l.id) === id);
    const name = String((found as any)?.name ?? '').trim();
    const address = String((found as any)?.address ?? '').trim();
    if (name) {
      return address ? `${name} — ${address}` : name;
    }
    if (address) {
      return address;
    }
    return `Lieu #${id}`;
  }

  scrollTo(sectionId: string): void {
    const id = String(sectionId ?? '').trim();
    if (!id) {
      return;
    }

    const el = document.getElementById(id);
    if (!el) {
      return;
    }

    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  navigateToLowStockResources(): void {
    this.scrollTo('low-stock-section');
  }

  navigateToVehicleMaintenance(vehicleId: number): void {
    if (vehicleId) {
      this.router.navigate(['/logistics/vehicles', vehicleId, 'maintenance']);
    }
  }

  toggleVoiceListening(): void {
    if (this.voiceListening) {
      this.stopVoiceListening();
      return;
    }
    this.startVoiceListening();
  }

  private startVoiceListening(): void {
    const SpeechRecognitionCtor = this.getSpeechRecognitionConstructor();
    if (!SpeechRecognitionCtor) {
      this.voiceAssistantMessage = 'Reconnaissance vocale non supportée sur ce navigateur.';
      return;
    }

    this.recognition = new SpeechRecognitionCtor();
    this.recognition.lang = 'fr-FR';
    this.recognition.continuous = true;
    this.recognition.interimResults = true;

    this.recognition.onstart = () => {
      this.voiceListening = true;
      this.voiceAssistantMessage = 'Écoute active... dites votre commande.';
    };

    this.recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      this.voiceTranscript = (finalTranscript || interimTranscript).trim();

      if (finalTranscript.trim()) {
        this.executeVoiceCommand(finalTranscript.trim(), true);
      }
    };

    this.recognition.onerror = () => {
      this.voiceAssistantMessage = 'Erreur micro. Vérifiez l’autorisation du microphone.';
      this.voiceListening = false;
    };

    this.recognition.onend = () => {
      this.voiceListening = false;
    };

    this.recognition.start();
  }

  private stopVoiceListening(): void {
    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }
    this.voiceListening = false;
  }

  private executeVoiceCommand(rawCommand: string, fromVoice: boolean): void {
    const command = this.normalizeVoiceText(rawCommand);
    if (!command) {
      return;
    }

    const now = Date.now();
    if (this.lastExecutedVoiceCommand === command && (now - this.lastExecutedAt) < 1800) {
      return;
    }
    this.lastExecutedVoiceCommand = command;
    this.lastExecutedAt = now;

    if (fromVoice) {
      this.voiceTranscript = rawCommand;
    }

    if (this.isAddResourceCommand(command)) {
      this.handleAddResourceCommand(command);
      return;
    }

    if (this.hasVerbAndTarget(command, ['liste', 'affiche', 'afficher', 'montre', 'montrer'], ['ressource', 'ressources'])) {
      this.voiceAssistantMessage = 'J ouvre la liste des ressources.';
      this.speak(this.voiceAssistantMessage);
      this.router.navigate(['/logistics/resources']);
      return;
    }

    if (this.hasVerbAndTarget(command, ['liste', 'affiche', 'afficher', 'montre', 'montrer'], ['vehicule', 'vehicules'])) {
      this.voiceAssistantMessage = 'J ouvre la liste des véhicules.';
      this.speak(this.voiceAssistantMessage);
      this.router.navigate(['/logistics/vehicles']);
      return;
    }

    if (this.hasVerbAndTarget(command, ['liste', 'affiche', 'afficher', 'montre', 'montrer'], ['transport', 'transports'])) {
      this.voiceAssistantMessage = 'J ouvre la liste des transports.';
      this.speak(this.voiceAssistantMessage);
      this.router.navigate(['/logistics/transports']);
      return;
    }

    if (this.isLowStockCommand(command)) {
      this.voiceAssistantMessage = 'J ouvre la liste des ressources en stock bas.';
      this.speak(this.voiceAssistantMessage);
      this.router.navigate(['/logistics/resources'], { queryParams: { filter: 'low-stock' } });
      return;
    }

    if (this.includesAny(command, ['vehicules risque', 'vehicule risque', 'risque cette semaine', 'maintenance vehicule'])) {
      this.voiceAssistantMessage = 'Je vous emmène vers les véhicules à risque.';
      this.speak(this.voiceAssistantMessage);
      this.scrollTo('vehicles-at-risk-section');
      return;
    }

    if (this.includesAny(command, ['prochains transports', 'prochain transport', 'transport semaine'])) {
      this.voiceAssistantMessage = 'Je vous emmène vers les prochains transports.';
      this.speak(this.voiceAssistantMessage);
      this.scrollTo('upcoming-transports-section');
      return;
    }

    if (this.hasVerbAndTarget(command, ['rafraichir', 'actualiser', 'recharger'], ['dashboard', 'tableau de bord'])) {
      this.voiceAssistantMessage = 'Je recharge le dashboard logistique.';
      this.speak(this.voiceAssistantMessage);
      this.loading = true;
      this.loadDashboard();
      return;
    }

    this.voiceAssistantMessage = 'Commande non reconnue. Essayez: ajouter ressource papier a4 quantite 20.';
    this.speak(this.voiceAssistantMessage);
  }

  private handleAddResourceCommand(command: string): void {
    const nameMatch = command.match(/(?:ajouter|ajoute|cree|creer)\s+(?:une\s+)?ressource\s+(.+?)(?=\s+(?:quantite|disponible|seuil|cout|prix|description|statut)\b|$)/i);
    const quantityMatch = command.match(/quantite\s+(\d+)/i);
    const availableMatch = command.match(/disponible\s+(\d+)/i);
    const thresholdMatch = command.match(/seuil\s+(\d+)/i);
    const costMatch = command.match(/(?:cout|prix)\s+(\d+(?:[\.,]\d+)?)/i);
    const descriptionMatch = command.match(/description\s+(.+)/i);

    const resourceName = nameMatch?.[1]?.trim();
    const quantityTotal = Number(quantityMatch?.[1] ?? 1);

    if (!this.clubId) {
      this.voiceAssistantMessage = 'Impossible d ajouter une ressource: clubId introuvable. Reconnectez-vous.';
      this.speak(this.voiceAssistantMessage);
      return;
    }

    if (!resourceName) {
      this.voiceAssistantMessage = 'Précisez le nom après ajouter ressource.';
      this.speak(this.voiceAssistantMessage);
      return;
    }

    const availableQuantity = Number(availableMatch?.[1] ?? quantityTotal);
    const lowStockThreshold = Number(thresholdMatch?.[1] ?? Math.max(1, Math.ceil(quantityTotal * 0.2)));
    const unitCost = Number(String(costMatch?.[1] ?? '0').replace(',', '.'));

    const payload: any = {
      name: resourceName,
      description: descriptionMatch?.[1]?.trim() ?? `Ajout vocal: ${resourceName}`,
      unitCost,
      status: this.extractResourceStatus(command),
      imageUrl: '',
      quantityTotal,
      availableQuantity,
      lowStockThreshold,
      notes: 'Créé via assistant vocal',
      lastUpdated: new Date().toISOString(),
      clubId: this.clubId
    };

    this.voiceAssistantMessage = `Ajout de la ressource ${resourceName} en cours...`;

    this.resourceService.create(payload).subscribe({
      next: () => {
        this.voiceAssistantMessage = `Ressource ${resourceName} ajoutée avec succès.`;
        this.speak(this.voiceAssistantMessage);
        this.loading = true;
        this.loadDashboard();
      },
      error: (error) => {
        console.error('[LogisticsDashboardComponent] voice add resource failed', error);
        this.voiceAssistantMessage = 'Échec de création de la ressource. Vérifiez votre commande et le club actif.';
        this.speak(this.voiceAssistantMessage);
      }
    });
  }

  private extractResourceStatus(command: string): 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'RETIRED' {
    if (this.includesAny(command, ['maintenance'])) {
      return 'MAINTENANCE';
    }
    if (this.includesAny(command, ['utilisation', 'in use', 'en cours'])) {
      return 'IN_USE';
    }
    if (this.includesAny(command, ['retire', 'retiree', 'hors service'])) {
      return 'RETIRED';
    }
    return 'AVAILABLE';
  }

  private getSpeechRecognitionConstructor(): any | null {
    const win = window as any;
    return win.SpeechRecognition || win.webkitSpeechRecognition || null;
  }

  private normalizeVoiceText(text: string): string {
    return String(text ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private includesAny(text: string, keywords: string[]): boolean {
    return keywords.some((keyword) => text.includes(keyword));
  }

  private hasVerbAndTarget(text: string, verbs: string[], targets: string[]): boolean {
    return this.includesAny(text, verbs) && this.includesAny(text, targets);
  }

  private isLowStockCommand(text: string): boolean {
    // Handles common voice recognition variants like "stock pas" or "stoc bas".
    if (this.includesAny(text, ['stock bas', 'stock pas', 'stoc bas', 'stocks bas', 'stock faible', 'stocks faibles'])) {
      return true;
    }

    const hasStockWord = this.includesAny(text, ['stock', 'stocks', 'stoc']);
    const hasLowWord = this.includesAny(text, ['bas', 'pas', 'faible', 'faibles', 'critique', 'critiques']);
    const hasListIntent = this.includesAny(text, ['liste', 'affiche', 'afficher', 'montre', 'montrer', 'ouvre', 'ouvrir']);

    return (hasStockWord && hasLowWord) ||
      (hasListIntent && hasStockWord && this.includesAny(text, ['ressource', 'ressources']));
  }

  private isAddResourceCommand(command: string): boolean {
    return this.includesAny(command, ['ajouter', 'ajoute', 'creer', 'cree']) &&
      this.includesAny(command, ['ressource', 'resource']);
  }

  private speak(message: string): void {
    if (!('speechSynthesis' in window) || !message) {
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = 'fr-FR';
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  }

  get paginatedTransports(): Transport[] {
    const start = (this.currentTransportPage - 1) * this.transportsPerPage;
    const end = start + this.transportsPerPage;
    return this.upcomingTransports.slice(start, end);
  }

  get totalTransportPages(): number {
    return Math.ceil(this.upcomingTransports.length / this.transportsPerPage);
  }

  nextTransportPage(): void {
    if (this.currentTransportPage < this.totalTransportPages) {
      this.currentTransportPage++;
    }
  }

  prevTransportPage(): void {
    if (this.currentTransportPage > 1) {
      this.currentTransportPage--;
    }
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    for (let i = 1; i <= this.totalTransportPages; i++) {
      pages.push(i);
    }
    return pages;
  }
}
