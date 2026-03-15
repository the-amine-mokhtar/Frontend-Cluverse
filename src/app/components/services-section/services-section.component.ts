import {
  Component,
  AfterViewInit,
  ViewChildren,
  QueryList,
  ElementRef,
  OnDestroy
} from '@angular/core';

interface Service {
  title: string;
  description: string;
  icon: string; // SVG path data
}

@Component({
  selector: 'app-services-section',
  templateUrl: './services-section.component.html',
  styleUrls: ['./services-section.component.scss']
})
export class ServicesSectionComponent implements AfterViewInit, OnDestroy {
  @ViewChildren('serviceCard') serviceCards!: QueryList<ElementRef>;

  private observer: IntersectionObserver | null = null;

  services: Service[] = [
    {
      title: 'Recruitment Managing',
      description: 'Streamline your entire recruitment pipeline — from open applications to interviews and onboarding — all in one unified platform.',
      icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M22 11h-6'
    },
    {
      title: 'Election Managing',
      description: 'Run fair, transparent internal elections with candidate management, secure voting, and real-time results dashboards.',
      icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11'
    },
    {
      title: 'Sponsorship Managing',
      description: 'Track sponsors, manage partnership proposals, and monitor sponsorship deliverables to build lasting relationships.',
      icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'
    },
    {
      title: 'Logistics Managing',
      description: 'Coordinate venues, equipment, and transportation with real-time tracking and task assignment across your team.',
      icon: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z'
    },
    {
      title: 'Event Managing',
      description: 'Plan, schedule, and execute events with integrated ticketing, attendee management, and post-event analytics.',
      icon: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z'
    },
    {
      title: 'Treasury Managing',
      description: 'Monitor budgets, track expenses, and generate financial reports to keep your club\'s finances transparent and organized.',
      icon: 'M2 17a5 5 0 0 0 10 0c0-2.76-2.5-5-5-3l5-10M12 17a5 5 0 0 0 10 0c0-2.76-2.5-5-5-3l5-10'
    },
    {
      title: 'Skills Managing',
      description: 'Map member competencies, identify skill gaps, and match the right people to the right tasks for maximum impact.',
      icon: 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3'
    }
  ];

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
