import { Component, Input, Output, EventEmitter, HostListener, OnInit } from '@angular/core';

export interface ServiceDetail {
  title: string;
  description: string;
}

export interface ServiceData {
  title: string;
  description: string;
  icon: string;
  details: ServiceDetail[];
}

@Component({
  selector: 'app-service-detail',
  templateUrl: './service-detail.component.html',
  styleUrls: ['./service-detail.component.scss']
})
export class ServiceDetailComponent implements OnInit {
  @Input() service!: ServiceData;
  @Output() closed = new EventEmitter<void>();

  isVisible = false;

  ngOnInit(): void {
    // Trigger entrance animation after component mounts
    requestAnimationFrame(() => {
      this.isVisible = true;
    });
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
  }

  close(): void {
    this.isVisible = false;
    document.body.style.overflow = '';
    setTimeout(() => this.closed.emit(), 300);
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.close();
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.close();
  }
}
