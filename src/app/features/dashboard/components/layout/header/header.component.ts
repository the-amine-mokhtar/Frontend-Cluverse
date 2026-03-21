import { Component, Output, EventEmitter, OnInit } from '@angular/core';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent implements OnInit {
  @Output() menuToggle = new EventEmitter<void>();

  today = '';
  searchQuery = '';

  ngOnInit(): void {
    this.today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }

  onMenuToggle(): void {
    this.menuToggle.emit();
  }
}
