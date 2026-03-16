import {
  Component,
  HostListener,
  OnInit
} from '@angular/core';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent implements OnInit {
  isAffix = false;
  isMenuOpen = false;

  navLinks = [
    { label: 'Home', target: 'top' },
    { label: 'Pricing', target: 'pricing' },
    { label: 'Services', target: 'services-section' },
    { label: 'FAQ', target: 'faq' },
    { label: 'Team', target: 'team' },
    { label: 'About Us', target: 'footer' }
  ];

  ngOnInit(): void {
    this.checkScroll();
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.checkScroll();
  }

  private checkScroll(): void {
    this.isAffix = window.scrollY > 50;
  }

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  scrollTo(target: string): void {
    this.isMenuOpen = false;
    if (target === 'top') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const el = document.getElementById(target);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
