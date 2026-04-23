import {
  Component,
  AfterViewInit,
  ViewChildren,
  QueryList,
  ElementRef,
  OnDestroy
} from '@angular/core';
import { ServiceData } from '../service-detail/service-detail.component';

@Component({
  selector: 'app-services-section',
  templateUrl: './services-section.component.html',
  styleUrls: ['./services-section.component.scss']
})
export class ServicesSectionComponent implements AfterViewInit, OnDestroy {
  @ViewChildren('serviceCard') serviceCards!: QueryList<ElementRef>;

  private observer: IntersectionObserver | null = null;

  selectedService: ServiceData | null = null;

  services: ServiceData[] = [
    {
      title: 'Recruitment Managing',
      description: 'Streamline your entire recruitment pipeline — from open applications to interviews and onboarding — all in one unified platform.',
      icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M22 11h-6',
      details: [
        { title: 'Formulaires personnalisables', description: 'Créez des formulaires de candidature adaptés à chaque département, avec des champs conditionnels et des validations automatiques.' },
        { title: 'Pipeline de recrutement', description: 'Suivez chaque candidat à travers les étapes : candidature → présélection → entretien → décision → onboarding.' },
        { title: 'Scoring automatique', description: 'Évaluez les candidats avec un système de notation configurable basé sur vos critères spécifiques.' },
        { title: 'Suivi des statuts', description: 'Mettez à jour le statut de chaque candidature en temps réel et notifiez automatiquement les candidats.' },
        { title: 'Onboarding intégré', description: 'Accueillez les nouveaux membres avec un parcours d\'intégration structuré et des tâches assignées.' }
      ]
    },
    {
      title: 'Election Managing',
      description: 'Run fair, transparent internal elections with candidate management, secure voting, and real-time results dashboards.',
      icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
      details: [
        { title: 'Gestion multi-postes', description: 'Organisez des élections pour plusieurs postes simultanément avec des configurations indépendantes pour chaque poste.' },
        { title: 'Tours multiples', description: 'Configurez des élections à un ou plusieurs tours avec des règles de qualification automatiques entre chaque tour.' },
        { title: 'Vote sécurisé', description: 'Garantissez l\'intégrité du vote avec un système anonyme et vérifiable, empêchant les doublons.' },
        { title: 'Candidatures en ligne', description: 'Permettez aux membres de se porter candidats directement depuis la plateforme avec leur programme.' },
        { title: 'Résultats en temps réel', description: 'Affichez les résultats avec des graphiques dynamiques dès la clôture du scrutin.' }
      ]
    },
    {
      title: 'Sponsorship Managing',
      description: 'Track sponsors, manage partnership proposals, and monitor sponsorship deliverables to build lasting relationships.',
      icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
      details: [
        { title: 'Base de données sponsors', description: 'Centralisez toutes les informations de vos sponsors et partenaires dans un annuaire structuré et consultable.' },
        { title: 'Suivi des propositions', description: 'Gérez le cycle de vie complet des propositions de partenariat : envoi → négociation → signature → livraison.' },
        { title: 'Gestion des contreparties', description: 'Suivez les engagements de chaque partie et assurez-vous que toutes les contreparties sont livrées à temps.' },
        { title: 'Historique des partenariats', description: 'Conservez un historique complet de chaque relation sponsor pour faciliter les reconductions.' },
        { title: 'Rapports financiers', description: 'Générez des rapports détaillés sur les revenus de sponsoring par période, événement ou département.' }
      ]
    },
    {
      title: 'Logistics Managing',
      description: 'Coordinate venues, equipment, and transportation with real-time tracking and task assignment across your team.',
      icon: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z',
      details: [
        { title: 'Réservation de salles', description: 'Consultez la disponibilité des salles et espaces, réservez en quelques clics et évitez les conflits de planning.' },
        { title: 'Gestion du matériel', description: 'Inventoriez votre matériel, suivez les emprunts et retours, et recevez des alertes en cas de manque.' },
        { title: 'Assignation de tâches', description: 'Répartissez les tâches logistiques entre les membres avec des deadlines et des notifications de rappel.' },
        { title: 'Check-lists événementielles', description: 'Créez des check-lists réutilisables pour chaque type d\'événement afin de ne rien oublier.' },
        { title: 'Suivi en temps réel', description: 'Visualisez l\'avancement de la préparation logistique avec un tableau de bord en temps réel.' }
      ]
    },
    {
      title: 'Event Managing',
      description: 'Plan, schedule, and execute events with integrated ticketing, attendee management, and post-event analytics.',
      icon: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
      details: [
        { title: 'Planification visuelle', description: 'Planifiez vos événements sur un calendrier interactif avec vue jour, semaine et mois.' },
        { title: 'Billetterie intégrée', description: 'Créez et distribuez des billets numériques avec QR codes pour un contrôle d\'accès simplifié.' },
        { title: 'Gestion des participants', description: 'Suivez les inscriptions, les confirmations de présence et gérez les listes d\'attente automatiquement.' },
        { title: 'Communication ciblée', description: 'Envoyez des notifications et rappels aux participants avant, pendant et après l\'événement.' },
        { title: 'Analytics post-événement', description: 'Analysez la participation, la satisfaction et le ROI de chaque événement avec des rapports détaillés.' }
      ]
    },
    {
      title: 'Treasury Managing',
      description: 'Monitor budgets, track expenses, and generate financial reports to keep your club\'s finances transparent and organized.',
      icon: 'M2 17a5 5 0 0 0 10 0c0-2.76-2.5-5-5-3l5-10M12 17a5 5 0 0 0 10 0c0-2.76-2.5-5-5-3l5-10',
      details: [
        { title: 'Suivi du budget', description: 'Définissez des budgets par département ou événement et suivez les dépenses en temps réel par rapport aux prévisions.' },
        { title: 'Gestion des dépenses', description: 'Enregistrez chaque dépense avec justificatifs, catégorisation et approbation des responsables.' },
        { title: 'Cotisations membres', description: 'Gérez la collecte des cotisations avec suivi des paiements et relances automatiques.' },
        { title: 'Rapports financiers', description: 'Générez des bilans financiers, des comptes de résultats et des rapports de trésorerie exportables.' },
        { title: 'Transparence totale', description: 'Offrez une visibilité complète aux membres sur la santé financière du club avec des dashboards accessibles.' }
      ]
    },
    {
      title: 'Skills Managing',
      description: 'Map member competencies, identify skill gaps, and match the right people to the right tasks for maximum impact.',
      icon: 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3',
      details: [
        { title: 'Cartographie des compétences', description: 'Visualisez les compétences de chaque membre sur une matrice interactive pour identifier forces et lacunes.' },
        { title: 'Profils de compétences', description: 'Chaque membre dispose d\'un profil détaillé listant ses compétences techniques, soft skills et certifications.' },
        { title: 'Matching intelligent', description: 'Associez automatiquement les bonnes personnes aux bonnes missions en fonction de leurs compétences et disponibilités.' },
        { title: 'Parcours de développement', description: 'Proposez des formations et des missions de montée en compétences personnalisées pour chaque membre.' },
        { title: 'Évaluation continue', description: 'Mettez en place des évaluations régulières pour suivre la progression et adapter les responsabilités.' }
      ]
    }
  ];

  onServiceClick(service: ServiceData): void {
    this.selectedService = service;
  }

  onCloseDetail(): void {
    this.selectedService = null;
  }

  ngAfterViewInit(): void {
    this.setupIntersectionObserver();
  }

  ngOnDestroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  private setupIntersectionObserver(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            this.observer?.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -50px 0px' }
    );

    this.serviceCards.forEach((card) => {
      this.observer?.observe(card.nativeElement);
    });
  }
}
