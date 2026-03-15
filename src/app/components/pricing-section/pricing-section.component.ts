import { Component, AfterViewInit, QueryList, ViewChildren, ElementRef } from '@angular/core';

@Component({
  selector: 'app-pricing-section',
  templateUrl: './pricing-section.component.html',
  styleUrls: ['./pricing-section.component.scss']
})
export class PricingSectionComponent implements AfterViewInit {
  @ViewChildren('pricingWrapper') pricingWrappers!: QueryList<ElementRef>;

  selectedDuration: 'monthly' | 'yearly' = 'monthly';
  private reverseAnimation = false;

  ngAfterViewInit(): void {
    // Ensure initial state
    this.updateVisibility(false);
  }

  onDurationChange(duration: 'monthly' | 'yearly'): void {
    if (duration === this.selectedDuration) return;

    this.selectedDuration = duration;
    this.triggerFlipAnimation();
  }

  private triggerFlipAnimation(): void {
    const wrappers = this.pricingWrappers.toArray().map(w => w.nativeElement as HTMLElement);

    wrappers.forEach(wrapper => {
      // Mark the newly selected items
      const targetItems = wrapper.querySelectorAll(`[data-type="${this.selectedDuration}"]`);
      targetItems.forEach(el => el.classList.add('is-selected'));

      // Add switched class + optional reverse
      if (this.reverseAnimation) {
        wrapper.classList.add('reverse-animation');
      } else {
        wrapper.classList.remove('reverse-animation');
      }
      wrapper.classList.add('is-switched');

      // Listen for animation end on the first wrapper to swap classes
      const firstVisible = wrapper.querySelector('.is-visible');
      if (firstVisible) {
        const onAnimEnd = () => {
          firstVisible.removeEventListener('animationend', onAnimEnd);

          // Swap visible/hidden classes
          wrapper.querySelectorAll('.is-visible').forEach(el => {
            el.classList.remove('is-visible');
            el.classList.add('is-hidden');
          });
          wrapper.querySelectorAll('.is-selected').forEach(el => {
            el.classList.remove('is-hidden', 'is-selected');
            el.classList.add('is-visible');
          });

          wrapper.classList.remove('is-switched');
        };
        firstVisible.addEventListener('animationend', onAnimEnd);
      }
    });

    // Toggle reverse for next switch
    this.reverseAnimation = !this.reverseAnimation;
  }

  private updateVisibility(animate: boolean): void {
    const wrappers = this.pricingWrappers?.toArray().map(w => w.nativeElement as HTMLElement);
    if (!wrappers) return;

    wrappers.forEach(wrapper => {
      wrapper.querySelectorAll('[data-type]').forEach(el => {
        const type = el.getAttribute('data-type');
        if (type === this.selectedDuration) {
          el.classList.add('is-visible');
          el.classList.remove('is-hidden');
        } else {
          el.classList.add('is-hidden');
          el.classList.remove('is-visible');
        }
        el.classList.remove('is-selected');
      });
    });
  }
}
