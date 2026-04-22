import { Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';

import { ResourceService } from '../../services/resource.service';
import { VehicleService } from '../../services/vehicle.service';
import { TransportService } from '../../services/transport.service';

@Component({
  selector: 'app-logistics-voice-assistant',
  templateUrl: './voice-assistant.component.html',
  styleUrl: './voice-assistant.component.scss'
})
export class VoiceAssistantComponent implements OnDestroy {
  isOpen = false;
  listening = false;
  supported = false;

  transcript = '';
  message = 'Assistant prêt. Cliquez sur micro et parlez.';

  private recognition: any | null = null;
  private lastCommand = '';
  private lastCommandAt = 0;

  constructor(
    private router: Router,
    private resourceService: ResourceService,
    private vehicleService: VehicleService,
    private transportService: TransportService
  ) {
    this.supported = !!this.getSpeechRecognitionConstructor();
  }

  ngOnDestroy(): void {
    this.stopListening();
  }

  toggleOpen(): void {
    this.isOpen = !this.isOpen;
  }

  toggleListening(): void {
    if (this.listening) {
      this.stopListening();
      return;
    }
    this.startListening();
  }

  private startListening(): void {
    const SpeechRecognitionCtor = this.getSpeechRecognitionConstructor();
    if (!SpeechRecognitionCtor) {
      this.message = 'Reconnaissance vocale non supportée.';
      return;
    }

    this.recognition = new SpeechRecognitionCtor();
    this.recognition.lang = 'fr-FR';
    this.recognition.continuous = true;
    this.recognition.interimResults = true;

    this.recognition.onstart = () => {
      this.listening = true;
      this.message = 'Écoute active...';
    };

    this.recognition.onresult = (event: any) => {
      let finalText = '';
      let interimText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += t;
        } else {
          interimText += t;
        }
      }

      this.transcript = (finalText || interimText).trim();

      if (finalText.trim()) {
        this.executeCommand(finalText.trim());
      }
    };

    this.recognition.onerror = () => {
      this.message = 'Erreur micro. Vérifiez les permissions.';
      this.listening = false;
    };

    this.recognition.onend = () => {
      this.listening = false;
    };

    this.recognition.start();
  }

  private stopListening(): void {
    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }
    this.listening = false;
  }

  private executeCommand(raw: string): void {
    const text = this.normalize(raw);
    if (!text) {
      return;
    }

    const now = Date.now();
    if (this.lastCommand === text && now - this.lastCommandAt < 1500) {
      return;
    }
    this.lastCommand = text;
    this.lastCommandAt = now;

    this.transcript = raw;

    if (this.isLowStock(text)) {
      this.message = 'Ouverture de la liste stock bas.';
      this.speak(this.message);
      this.router.navigate(['/logistics/resources'], { queryParams: { filter: 'low-stock' } });
      return;
    }

    if (this.isListCommand(text, ['ressource', 'ressources', 'stock', 'stocks'])) {
      this.message = 'Ouverture de la liste des ressources.';
      this.speak(this.message);
      this.router.navigate(['/logistics/resources']);
      return;
    }

    if (this.isVehiclesAtRiskCommand(text)) {
      this.message = 'Ouverture des véhicules à risque cette semaine.';
      this.speak(this.message);
      this.router.navigate(['/logistics/dashboard']);
      return;
    }

    if (this.isListCommand(text, ['vehicule', 'vehicules'])) {
      this.message = 'Ouverture de la liste des véhicules.';
      this.speak(this.message);
      this.router.navigate(['/logistics/vehicles']);
      return;
    }

    if (this.isListCommand(text, ['transport', 'transports', 'trajet', 'trajets'])) {
      this.message = 'Ouverture de la liste des transports.';
      this.speak(this.message);
      this.router.navigate(['/logistics/transports']);
      return;
    }

    if (this.isCreateCommand(text, ['ressource', 'ressources'])) {
      this.handleCreateResource(text);
      return;
    }

    if (this.isCreateCommand(text, ['vehicule', 'vehicules'])) {
      this.message = 'Ouverture du formulaire de création véhicule.';
      this.speak(this.message);
      this.router.navigate(['/logistics/vehicles/new']);
      return;
    }

    if (this.isCreateCommand(text, ['transport', 'transports', 'demarrer', 'demarre', 'commencer', 'lancer'])) {
      this.message = 'Ouverture du formulaire de création transport.';
      this.speak(this.message);
      this.router.navigate(['/logistics/transports/new']);
      return;
    }

    if (this.isPlannerCommand(text)) {
      this.message = 'Ouverture du planificateur IA.';
      this.speak(this.message);
      this.router.navigate(['/logistics/planner']);
      return;
    }

    if (this.isRouteAnalysisCommand(text)) {
      this.message = 'Ouverture du planificateur IA et lancement automatique.';
      this.speak(this.message);
      this.router.navigate(['/logistics/planner'], {
        queryParams: {
          autoGenerate: '1',
          requestAt: Date.now().toString()
        }
      });
      return;
    }

    if (this.isUpdateCommand(text, ['ressource', 'ressources'])) {
      this.handleUpdateRoute('/logistics/resources', text);
      return;
    }

    if (this.isUpdateCommand(text, ['vehicule', 'vehicules'])) {
      this.handleUpdateRoute('/logistics/vehicles', text);
      return;
    }

    if (this.isUpdateCommand(text, ['transport', 'transports'])) {
      this.handleUpdateRoute('/logistics/transports', text);
      return;
    }

    if (this.isDeleteCommand(text, ['ressource', 'ressources'])) {
      this.handleDeleteResource(text);
      return;
    }

    if (this.isDeleteCommand(text, ['vehicule', 'vehicules'])) {
      this.handleDeleteVehicle(text);
      return;
    }

    if (this.isDeleteCommand(text, ['transport', 'transports'])) {
      this.handleDeleteTransport(text);
      return;
    }

    this.message = 'Commande non reconnue. Exemples: liste des véhicules, supprimer ressource papier.';
    this.speak(this.message);
  }

  private handleCreateResource(text: string): void {
    const nameMatch = text.match(/(?:ajouter|ajoute|creer|cree)\s+(?:une\s+)?ressource\s+(.+?)(?=\s+(?:quantite|disponible|seuil|cout|prix|description|statut)\b|$)/i);
    const quantityMatch = text.match(/quantite\s+(\d+)/i);
    const availableMatch = text.match(/disponible\s+(\d+)/i);
    const thresholdMatch = text.match(/seuil\s+(\d+)/i);
    const costMatch = text.match(/(?:cout|prix)\s+(\d+(?:[\.,]\d+)?)/i);
    const descriptionMatch = text.match(/description\s+(.+)/i);

    const name = nameMatch?.[1]?.trim();
    if (!name) {
      this.message = 'Précisez le nom: ajouter ressource papier A4 quantité 20.';
      this.speak(this.message);
      return;
    }

    const quantityTotal = Number(quantityMatch?.[1] ?? 1);
    const availableQuantity = Number(availableMatch?.[1] ?? quantityTotal);
    const lowStockThreshold = Number(thresholdMatch?.[1] ?? Math.max(1, Math.ceil(quantityTotal * 0.2)));
    const unitCost = Number(String(costMatch?.[1] ?? '0').replace(',', '.'));

    this.message = `J ouvre le formulaire d ajout pour ${name}.`;
    this.speak(this.message);

    this.router.navigate(['/logistics/resources/new'], {
      queryParams: {
        voicePrefill: '1',
        name,
        quantityTotal,
        availableQuantity,
        lowStockThreshold,
        unitCost,
        status: this.extractResourceStatus(text),
        description: descriptionMatch?.[1]?.trim() ?? `Ajout vocal: ${name}`,
        notes: 'Pré-rempli via assistant vocal'
      }
    });
  }

  private handleUpdateRoute(basePath: string, text: string): void {
    const id = this.extractId(text);
    if (id !== null) {
      this.message = `Ouverture de la modification ID ${id}.`;
      this.speak(this.message);
      this.router.navigate([`${basePath}/${id}/edit`]);
      return;
    }

    this.message = 'Donnez un identifiant. Exemple: modifier véhicule id 5.';
    this.speak(this.message);
    this.router.navigate([basePath]);
  }

  private handleDeleteResource(text: string): void {
    const clubId = Number(localStorage.getItem('clubId') ?? 0);
    const resourceName = this.extractEntityName(text, ['ressource', 'ressources']);

    if (!resourceName) {
      this.message = 'Dites par exemple: supprimer ressource papier A4.';
      this.speak(this.message);
      return;
    }

    this.resourceService.getAll(clubId).subscribe({
      next: (resources) => {
        const match = this.findResourceByName(resources, resourceName);
        if (!match) {
          this.message = `Aucune ressource trouvée avec le nom ${resourceName}.`;
          this.speak(this.message);
          return;
        }

        this.resourceService.delete(match.id).subscribe({
          next: () => {
            this.message = `Ressource ${match.name} supprimée.`;
            this.speak(this.message);
            this.router.navigate(['/logistics/resources']);
          },
          error: () => {
            this.message = `Suppression ressource ${match.name} impossible.`;
            this.speak(this.message);
          }
        });
      },
      error: () => {
        this.message = 'Impossible de charger la liste des ressources.';
        this.speak(this.message);
      }
    });
  }

  private handleDeleteVehicle(text: string): void {
    const vehicleName = this.extractEntityName(text, ['vehicule', 'vehicules']);

    if (!vehicleName) {
      this.message = 'Dites par exemple: supprimer véhicule toyota.';
      this.speak(this.message);
      return;
    }

    this.vehicleService.getAll().subscribe({
      next: (vehicles) => {
        const match = this.findVehicleByName(vehicles, vehicleName);
        if (!match) {
          this.message = `Aucun véhicule trouvé avec ${vehicleName}.`;
          this.speak(this.message);
          return;
        }

        this.vehicleService.delete(match.id).subscribe({
          next: () => {
            this.message = `Véhicule ${match.model} (${match.plateNumber}) supprimé.`;
            this.speak(this.message);
            this.router.navigate(['/logistics/vehicles']);
          },
          error: () => {
            this.message = `Suppression véhicule ${match.model} impossible.`;
            this.speak(this.message);
          }
        });
      },
      error: () => {
        this.message = 'Impossible de charger la liste des véhicules.';
        this.speak(this.message);
      }
    });
  }

  private handleDeleteTransport(text: string): void {
    const id = this.extractId(text);
    if (id === null) {
      this.message = 'Pour supprimer un transport, dites: supprimer transport id 4.';
      this.speak(this.message);
      return;
    }

    this.transportService.delete(id).subscribe({
      next: () => {
        this.message = `Transport ${id} supprimé.`;
        this.speak(this.message);
        this.router.navigate(['/logistics/transports']);
      },
      error: () => {
        this.message = `Suppression transport ${id} impossible.`;
        this.speak(this.message);
      }
    });
  }

  private extractResourceStatus(text: string): 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'RETIRED' {
    if (this.includesAny(text, ['maintenance'])) {
      return 'MAINTENANCE';
    }
    if (this.includesAny(text, ['utilisation', 'in use', 'en cours'])) {
      return 'IN_USE';
    }
    if (this.includesAny(text, ['retire', 'retiree', 'hors service'])) {
      return 'RETIRED';
    }
    return 'AVAILABLE';
  }

  private isVehiclesAtRiskCommand(text: string): boolean {
    return this.includesAny(text, [
      'vehicules a risque',
      'vehicule a risque',
      'vehicules risques',
      'vehicules a risques',
      'vehicules en risque',
      'vehicules a surveiller',
      'risque cette semaine',
      'liste des vehicules a risque',
      'liste des vehicules a risques'
    ]);
  }

  private isRouteAnalysisCommand(text: string): boolean {
    return this.includesAny(text, [
      'analyse de trajet',
      'analyser trajet',
      'analyse trajet',
      'analyse du trajet',
      'etude de trajet',
      'predire trajet',
      'prediction trajet',
      'prevision trajet',
      'demarrer trajet',
      'lancer analyse trajet'
    ]);
  }

  private isPlannerCommand(text: string): boolean {
    return this.includesAny(text, [
      'planificateur ia',
      'planifier ia',
      'ouvrir planificateur ia',
      'generer le plan ia',
      'planification ia'
    ]);
  }

  private isLowStock(text: string): boolean {
    if (this.includesAny(text, ['stock bas', 'stock pas', 'stoc bas', 'stocks bas', 'stock faible'])) {
      return true;
    }

    const hasStock = this.includesAny(text, ['stock', 'stocks', 'stoc']);
    const hasLow = this.includesAny(text, ['bas', 'pas', 'faible', 'critique', 'critiques']);
    const hasIntent = this.includesAny(text, ['liste', 'affiche', 'afficher', 'montre', 'montrer', 'ouvre', 'ouvrir']);
    return (hasStock && hasLow) || (hasIntent && hasStock);
  }

  private isListCommand(text: string, targets: string[]): boolean {
    return this.includesAny(text, ['liste', 'affiche', 'afficher', 'montre', 'montrer', 'ouvre', 'ouvrir']) &&
      this.includesAny(text, targets);
  }

  private isCreateCommand(text: string, targets: string[]): boolean {
    return this.includesAny(text, ['ajouter', 'ajoute', 'creer', 'cree', 'nouveau', 'nouvelle', 'demarrer', 'demarre', 'commencer', 'lancer']) &&
      this.includesAny(text, targets);
  }

  private isUpdateCommand(text: string, targets: string[]): boolean {
    return this.includesAny(text, ['modifier', 'modifie', 'mettre a jour', 'editer', 'editer']) &&
      this.includesAny(text, targets);
  }

  private isDeleteCommand(text: string, targets: string[]): boolean {
    return this.includesAny(text, ['supprimer', 'supprime', 'effacer', 'delete']) &&
      this.includesAny(text, targets);
  }

  private extractId(text: string): number | null {
    const explicit = text.match(/\bid\s*(\d+)\b/i);
    if (explicit) {
      return Number(explicit[1]);
    }

    const anyNumber = text.match(/\b(\d+)\b/);
    return anyNumber ? Number(anyNumber[1]) : null;
  }

  private extractEntityName(text: string, targets: string[]): string | null {
    for (const target of targets) {
      const idx = text.indexOf(target);
      if (idx < 0) {
        continue;
      }

      let after = text.slice(idx + target.length).trim();
      after = after.replace(/^(nom|appele|appelee|appelé|appelée)\s+/i, '').trim();
      after = after.replace(/[.,;:!?]+$/g, '').trim();

      if (!after || after.startsWith('id ')) {
        return null;
      }

      return after;
    }
    return null;
  }

  private findResourceByName(resources: any[], requestedName: string): any | null {
    const query = this.normalize(requestedName);
    if (!query) {
      return null;
    }

    const exact = resources.find((r) => this.normalize(String(r?.name ?? '')) === query);
    if (exact) {
      return exact;
    }

    const contains = resources.find((r) => this.normalize(String(r?.name ?? '')).includes(query));
    if (contains) {
      return contains;
    }

    return resources.find((r) => query.includes(this.normalize(String(r?.name ?? '')))) ?? null;
  }

  private findVehicleByName(vehicles: any[], requestedName: string): any | null {
    const query = this.normalize(requestedName);
    if (!query) {
      return null;
    }

    const exact = vehicles.find((v) => {
      const model = this.normalize(String(v?.model ?? ''));
      const plate = this.normalize(String(v?.plateNumber ?? ''));
      return model === query || plate === query;
    });
    if (exact) {
      return exact;
    }

    const contains = vehicles.find((v) => {
      const model = this.normalize(String(v?.model ?? ''));
      const plate = this.normalize(String(v?.plateNumber ?? ''));
      return model.includes(query) || plate.includes(query);
    });
    if (contains) {
      return contains;
    }

    return vehicles.find((v) => {
      const model = this.normalize(String(v?.model ?? ''));
      const plate = this.normalize(String(v?.plateNumber ?? ''));
      return query.includes(model) || query.includes(plate);
    }) ?? null;
  }

  private getSpeechRecognitionConstructor(): any | null {
    const win = window as any;
    return win.SpeechRecognition || win.webkitSpeechRecognition || null;
  }

  private normalize(text: string): string {
    return String(text ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private includesAny(text: string, words: string[]): boolean {
    return words.some((word) => text.includes(word));
  }

  private speak(message: string): void {
    if (!('speechSynthesis' in window) || !message) {
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(message);
    u.lang = 'fr-FR';
    u.rate = 1;
    u.pitch = 1;
    window.speechSynthesis.speak(u);
  }
}
