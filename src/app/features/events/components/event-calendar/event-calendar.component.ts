import { Component, OnInit, Input } from '@angular/core';
import {
  EventApiService,
  EventItem,
  normalizeEvent   // AMÉLIORATION: import de la fonction centralisée
} from '../../services/event-api.service';

interface CalendarCell {
  day: number;
  date: Date | null;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: EventItem[];
}

@Component({
  selector: 'app-event-calendar',
  templateUrl: './event-calendar.component.html',
  styleUrls: ['./event-calendar.component.scss']
})
export class EventCalendarComponent implements OnInit {

  @Input() events: EventItem[] = [];

  calendarCells: CalendarCell[] = [];
  selectedDate: Date | null = null;
  selectedDayEvents: EventItem[] = [];

  currentDate = new Date();
  currentYear  = this.currentDate.getFullYear();
  currentMonth = this.currentDate.getMonth();

  dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  get currentMonthLabel(): string {
    return this.currentDate.toLocaleString('default', {
      month: 'long',
      year:  'numeric'
    });
  }

  constructor(private eventService: EventApiService) {}

  ngOnInit(): void {
    if (this.events.length === 0) {
      this.loadEvents();
    } else {
      this.buildCalendar();
    }
  }

  // ── Load ────────────────────────────────────────────────────────────────────

  private loadEvents(): void {
    this.eventService.getAllEvents().subscribe({
      next: res => {
        console.log('[Calendar] Raw events from API:', res.length, res);
        this.events = res
  .map(e => normalizeEvent(e))
  .filter(e => e.status !== 'CANCELLED'); // Corrected to match EventStatus type
        console.log('[Calendar] Normalized events:', this.events.length);
        this.buildCalendar();
      },
      error: err => console.error('[Calendar] Load error:', err)
    });
  }

  buildCalendar(): void {
    this.currentDate = new Date(this.currentYear, this.currentMonth, 1);
    const cells: CalendarCell[] = [];
    const today = new Date();

    const firstDay = new Date(this.currentYear, this.currentMonth, 1).getDay();
    const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
    const daysInPrev  = new Date(this.currentYear, this.currentMonth, 0).getDate();

    // Jours du mois précédent
    for (let i = firstDay - 1; i >= 0; i--) {
      cells.push({
        day:            daysInPrev - i,
        date:           null,
        isCurrentMonth: false,
        isToday:        false,
        events:         []
      });
    }

    // Jours du mois courant
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(this.currentYear, this.currentMonth, d);
      cells.push({
        day:            d,
        date,
        isCurrentMonth: true,
        isToday:        this.isSameDay(date, today),
        events:         this.getEventsForDate(date)
      });
    }

    // Complétion avec les jours du mois suivant
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      cells.push({
        day:            d,
        date:           new Date(this.currentYear, this.currentMonth + 1, d),
        isCurrentMonth: false,
        isToday:        false,
        events:         []
      });
    }

    this.calendarCells = cells;
  }

 private getEventsForDate(date: Date): EventItem[] {
  return this.events.filter(e => {
    if (!e.startDate) return false;
    const start = new Date(e.startDate);
    return (
      date.getFullYear() === start.getFullYear() &&
      date.getMonth()    === start.getMonth()    &&
      date.getDate()     === start.getDate()
    );
  });
}

  // ── Navigation ──────────────────────────────────────────────────────────────

  prevMonth(): void {
    this.currentMonth--;
    if (this.currentMonth < 0) {
      this.currentMonth = 11;
      this.currentYear--;
    }
    this.buildCalendar();
  }

  nextMonth(): void {
    this.currentMonth++;
    if (this.currentMonth > 11) {
      this.currentMonth = 0;
      this.currentYear++;
    }
    this.buildCalendar();
  }

  goToToday(): void {
    const today = new Date();
    this.currentYear  = today.getFullYear();
    this.currentMonth = today.getMonth();
    this.buildCalendar();
    this.selectDayByDate(today);
  }

  // ── Selection ───────────────────────────────────────────────────────────────

  selectDay(cell: CalendarCell): void {
    if (!cell.date || !cell.isCurrentMonth) return;
    this.selectedDate      = cell.date;
    this.selectedDayEvents = cell.events;
  }

  private selectDayByDate(date: Date): void {
    const cell = this.calendarCells.find(
      c => c.date && this.isSameDay(c.date, date)
    );
    if (cell) this.selectDay(cell);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  isSameDay(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth()    === b.getMonth()    &&
      a.getDate()     === b.getDate()
    );
  }
}