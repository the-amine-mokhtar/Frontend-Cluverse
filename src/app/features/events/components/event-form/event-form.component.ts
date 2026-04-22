import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { EventApiService, EventRequestPayload, EventItem } from '../../services/event-api.service';
import { CampaignApiService } from '../../services/campaign-api.service';
import { AuthHelperService } from '../../../../core/services/auth-helper.service';
import { EventStatusChangeService } from '../../services/event-status-change.service';

@Component({
  selector: 'app-event-form',
  templateUrl: './event-form.component.html',
  styleUrls: ['./event-form.component.scss']
})
export class EventFormComponent implements OnInit {

  eventForm!: FormGroup;
  isEditMode = false;
  eventId?: number;
  hasError = false;
  errorMessage: string = '';
  isSubmitting = false;
  suggestions: any[] = [];
  minStartDate: string = this.getMinDateTime();
  campaigns: any[] = [];
  selectedCampaign: any = null;
  campaignEvents: any[] = [];
  loadingCampaignEvents = false;

  map: any;
  marker: any;

  eventCategories = [
    { value: 'WORKSHOP',    label: 'Workshop' },
    { value: 'CONFERENCE',  label: 'Conférence' },
    { value: 'MEETING',     label: 'Réunion' },
    { value: 'HACKATHON',   label: 'Hackathon' },
    { value: 'NETWORKING',  label: 'Networking' },
    { value: 'COMPETITION', label: 'Compétition' },
    { value: 'SEMINAR',     label: 'Séminaire' },
    { value: 'TRAINING',    label: 'Formation' },
    { value: 'SOCIAL',      label: 'Événement social' },
    { value: 'OTHER',       label: 'Autre' }
  ];

  showCustomCategoryInput = false;
  customCategory = '';

  // ─── Statut avant édition (pour notifier le changement) ───────────────────
  private previousStatus: string = '';

  constructor(
    private fb: FormBuilder,
    private eventService: EventApiService,
    private campaignService: CampaignApiService,
    private router: Router,
    private route: ActivatedRoute,
    private authHelper: AuthHelperService,               // ✅ injecté
    private eventStatusChangeService: EventStatusChangeService // ✅ injecté
  ) {}

  ngOnInit(): void {
    this.initForm();
    
    // ✅ Charger les campagnes d'abord, puis gérer les route params
    this.loadCampaigns();

    this.route.params.subscribe(params => {
      if (params['id']) {
        this.isEditMode = true;
        this.eventId = +params['id'];
        // Attendre un peu que les campagnes se chargent
        const id = this.eventId; // ✅ Capturer la valeur pour éviter undefined
        setTimeout(() => this.loadEvent(id), 100);
      }
    });

    this.route.queryParams.subscribe(queryParams => {
      if (queryParams['campaignId']) {
        const campaignId = +queryParams['campaignId'];
        this.eventForm.patchValue({ campaignId });
        this.campaignService.getCampaignById(campaignId).subscribe({
          next: (campaign) => { this.selectedCampaign = campaign; },
          error: (err) => { console.error('Error loading campaign:', err); }
        });
      }
    });
  }

  initForm(): void {
    this.eventForm = this.fb.group({
      title:       ['', [Validators.required, Validators.minLength(3), this.validateNoProfanity]],
      description: ['', [this.validateNoProfanity]],
      location:    ['', [Validators.required, this.validateNoProfanity]],
      latitude:    [''],
      longitude:   [''],
      startDate:   ['', [Validators.required, this.validateStartDate]],
      endDate:     ['', [Validators.required, this.validateEndDate]],
      category:    ['WORKSHOP', Validators.required],
      capacity:    [null, Validators.min(1)],
      imageUrl:    [''],
      status:      ['PLANNED'],
      isPaid:      [false, Validators.required],
      price:       [null],
      campaignId:  [null]
    });

    this.eventForm.get('isPaid')?.valueChanges.subscribe(isPaid => {
      const priceControl = this.eventForm.get('price');
      if (isPaid === true) {
        priceControl?.setValidators([Validators.required, Validators.min(0.01)]);
      } else {
        priceControl?.clearValidators();
        priceControl?.setValue(null);
      }
      priceControl?.updateValueAndValidity();
    });

    this.eventForm.get('campaignId')?.valueChanges.subscribe(campaignId => {
      if (campaignId) {
        this.loadCampaignEvents(campaignId);
      } else {
        this.campaignEvents = [];
      }
    });

    this.eventForm.get('startDate')?.valueChanges.subscribe(() => {
      this.eventForm.get('endDate')?.updateValueAndValidity();
    });
  }

  // ─── Charger les campagnes ─────────────────────────────────────────────────
  // Le backend filtre déjà : expirées exclues, PRIVATE non autorisées exclues,
  // SHARED sans permission exclues → on affiche tout ce qu'on reçoit
  loadCampaigns(): void {
    // ✅ Utiliser la nouvelle méthode qui filtre correctement selon visibilité et permissions
    this.campaignService.getCampaignsForEventForm().subscribe({
      next: (campaigns) => {
        this.campaigns = campaigns;
        console.log('[EventForm] Campaigns loaded for event form:', this.campaigns.length);
      },
      error: (err) => {
        console.error('Error loading campaigns:', err);
        this.hasError = true;
        this.errorMessage = 'Failed to load campaigns. Please try again.';
      }
    });
  }

  loadCampaignEvents(campaignId: number): void {
    this.loadingCampaignEvents = true;
    this.campaignService.getCampaignEvents(campaignId).subscribe({
      next: (events) => {
        this.campaignEvents = events;
        this.loadingCampaignEvents = false;
      },
      error: (err) => {
        console.error('Error loading campaign events:', err);
        this.campaignEvents = [];
        this.loadingCampaignEvents = false;
      }
    });
  }

  getMinDateTime(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const h = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d}T${h}:${min}`;
  }

  validateStartDate = (control: any) => {
    if (!control.value) return null;
    if (this.isEditMode) return null; // En édition, dates passées autorisées
    const inputDate = new Date(control.value);
    const now = new Date();
    return inputDate >= now ? null : { startDateInPast: true };
  };

  validateEndDate = (control: any) => {
    if (!control?.parent) return null;
    const startDate = control.parent.get('startDate')?.value;
    const endDate = control.value;
    if (!startDate || !endDate) return null;
    return new Date(endDate) >= new Date(startDate) ? null : { endDateBeforeStart: true };
  };

  validateNoProfanity = (control: any) => {
    if (!control.value) return null;
    const value = control.value.toLowerCase();
    const badWords = ['merde', 'putain', 'connard', 'salope', 'enculé', 'bite', 'foutre', 'bordel', 'fuck', 'shit', 'asshole', 'bitch'];
    return badWords.some(w => value.includes(w)) ? { hasProfanity: true } : null;
  };

  onLocationSelected(coords: { lat: number; lng: number }): void {
    const { lat, lng } = coords;
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
      .then(res => res.json())
      .then(data => {
        this.eventForm.patchValue({
          location: data.display_name || `Lat: ${lat}, Lng: ${lng}`,
          latitude: lat, longitude: lng
        });
      })
      .catch(() => {
        this.eventForm.patchValue({
          location: `Lat: ${lat}, Lng: ${lng}`, latitude: lat, longitude: lng
        });
      });
  }

  selectSuggestion(s: any): void {
    const lat = parseFloat(s.lat);
    const lon = parseFloat(s.lon);
    this.eventForm.patchValue({ location: s.display_name, latitude: lat, longitude: lon });
    if (this.marker && this.map) {
      this.marker.setLngLat([lon, lat]);
      this.map.flyTo({ center: [lon, lat], zoom: 15, duration: 1000 });
    }
    this.suggestions = [];
  }

  onLocationInput(event: any): void {
    const query = event.target.value;
    if (query.length > 2) {
      fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`)
        .then(res => res.json())
        .then(data => this.suggestions = data)
        .catch(() => this.suggestions = []);
    } else {
      this.suggestions = [];
    }
  }

  onFileChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    this.eventService.uploadImage(formData).subscribe({
      next: (res: { url: string }) => this.eventForm.patchValue({ imageUrl: res.url }),
      error: () => alert('Erreur lors de l\'upload de l\'image')
    });
  }

  
  submit() {
    if (this.eventForm.invalid) {
      this.eventForm.markAllAsTouched();
      // Scroll to first error
      const firstErrorElement = document.querySelector('.field-error');
      if (firstErrorElement) {
        firstErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    this.isSubmitting = true;
    this.hasError = false;
    this.errorMessage = '';

    const payload: EventRequestPayload = { ...this.eventForm.value };
    const request$ = this.isEditMode && this.eventId
      ? this.eventService.updateEvent(this.eventId, payload)
      : this.eventService.createEvent(payload);

    request$.subscribe({
      next: (event: EventItem) => {
        console.log('✅ Event saved successfully:', event);
        
        // Notifier le changement de status si en mode edit
        if (this.isEditMode && event.status !== this.previousStatus) {
          this.eventStatusChangeService.notifyStatusChange(event.id, event.status || 'PLANNED');
        }
        
        // ✅ AJOUT: Notifier le rechargement des events (nouveau event créé)
        if (!this.isEditMode) {
          setTimeout(() => {
            this.eventStatusChangeService.notifyReloadEvents();
            console.log('✅ [EventForm] Notified to reload events');
          }, 300);
        }
        
        this.isSubmitting = false;
        this.errorMessage = '';
        
        // Afficher un message de succès avant de rediriger
        setTimeout(() => {
          this.router.navigate(['/dashboard/events']);
        }, 500);
      },
      error: (err) => { 
        console.error('❌ Failed to save event:', err);
        
        // Extraire le message d'erreur du serveur
        let errorMsg = 'Failed to save event';
        
        if (err.status === 400 || err.status === 422) {
          // Erreur de validation
          if (err.error?.message) {
            errorMsg = err.error.message;
          } else if (err.error?.errors) {
            errorMsg = Object.values(err.error.errors).join(', ');
          } else {
            errorMsg = 'Validation error. Please check all fields.';
          }
        } else if (err.status === 403) {
          errorMsg = 'You do not have permission to edit this event.';
        } else if (err.status === 404) {
          errorMsg = 'Event not found.';
        } else if (err.status === 0) {
          errorMsg = 'Network error. Please check your connection.';
        }
        
        this.errorMessage = errorMsg;
        this.hasError = true;
        this.isSubmitting = false;
        
        // Scroll vers le message d'erreur
        setTimeout(() => {
          const errorElement = document.querySelector('.form-error');
          if (errorElement) {
            errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }
    });
  }

  cancel(): void { this.router.navigate(['dashboard/events']); }

  // ─── Category Management ──────────────────────────────────────────────────
  onCategoryChange(event: any): void {
    const value = event.target.value;
    if (value === 'ADD_NEW') {
      this.showCustomCategoryInput = true;
      this.eventForm.patchValue({ category: 'OTHER' });
    } else {
      this.showCustomCategoryInput = false;
      this.customCategory = '';
      this.eventForm.patchValue({ category: value });
    }
  }

  addCustomCategory(): void {
    const newCat = this.customCategory.trim().toUpperCase();
    if (newCat.length > 0) {
      if (!this.eventCategories.find(c => c.value === newCat)) {
        this.eventCategories.push({ value: newCat, label: this.customCategory });
      }
      this.eventForm.patchValue({ category: newCat });
      this.customCategory = '';
      this.showCustomCategoryInput = false;
    }
  }

  cancelCustomCategory(): void {
    this.customCategory = '';
    this.showCustomCategoryInput = false;
    this.eventForm.patchValue({ category: 'OTHER' });
  }

  // ─── Charger event en édition ─────────────────────────────────────────────
  loadEvent(id: number): void {
    this.eventService.getEventById(id).subscribe({
      next: (event) => {
        // Sauvegarder le statut actuel pour pouvoir notifier le changement
        this.previousStatus = event.status ?? 'PLANNED';

        // ✅ Formater les dates correctement pour input HTML
        const formatDateForInput = (dateStr: string | undefined): string => {
          if (!dateStr) return '';
          try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            const h = String(date.getHours()).padStart(2, '0');
            const min = String(date.getMinutes()).padStart(2, '0');
            return `${y}-${m}-${d}T${h}:${min}`;
          } catch {
            return dateStr;
          }
        };

        this.eventForm.patchValue({
          title:       event.title ?? '',
          description: event.description ?? '',
          location:    event.locationName ?? '',
          latitude:    event.locationLatitude ?? '',
          longitude:   event.locationLongitude ?? '',
          startDate:   formatDateForInput(event.startDate),
          endDate:     formatDateForInput(event.endDate),
          category:    event.category ?? 'WORKSHOP',
          capacity:    event.capacity ?? null,
          imageUrl:    event.imageUrl ?? '',
          status:      event.status ?? 'PLANNED',
          isPaid:      event.isPaid ?? false,
          price:       event.price ?? null,
          campaignId:  event.campaignId ?? null
        });

        // ✅ Marquer le formulaire comme untouched et non-dirty après le chargement
        this.eventForm.markAsUntouched({ onlySelf: false });
        this.eventForm.markAsPristine({ onlySelf: false });

        // Trouver la campagne dans la liste chargée
        this.selectedCampaign = this.campaigns.find(c => c.id === event.campaignId) || null;

        // Si la campagne est expirée, la désélectionner
        if (this.selectedCampaign) {
          const now = new Date();
          const endDate = this.selectedCampaign.endDate
            ? new Date(this.selectedCampaign.endDate) : null;
          if (endDate && endDate <= now) {
            this.selectedCampaign = null;
            this.eventForm.patchValue({ campaignId: null });
          }
        }

        console.log('✅ Event loaded for editing:', event);
      },
      error: (err) => {
        console.error('Error loading event:', err);
        this.hasError = true;
        this.errorMessage = err.error?.message || 'Failed to load event. Please try again.';
      }
    });
  }

  getCurrentEventForMap(): EventItem[] {
    const v = this.eventForm.value;
    if (v.latitude && v.longitude) {
      return [{
        id:              this.eventId || 0,
        title:           v.title || 'New Event',
        description:     v.description || '',
        locationName:    v.location || '',
        locationLatitude:  v.latitude,
        locationLongitude: v.longitude,
        startDate:       v.startDate || new Date().toISOString(),
        endDate:         v.endDate || new Date().toISOString(),
        category:        v.category || 'WORKSHOP',
        capacity:        v.capacity || 0,
        participantsCount: 0,
        status:          'PLANNED',
        imageUrl:        v.imageUrl || '',
        isPaid:          v.isPaid || false,
        price:           v.price || 0
      }];
    }
    return [];
  }
}