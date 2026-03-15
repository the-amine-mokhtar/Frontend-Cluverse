import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  NgZone
} from '@angular/core';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface TextBeat {
  id: string;
  title: string;
  subtitle: string;
  alignment: 'center' | 'left' | 'right';
  scrollStart: number;
  scrollEnd: number;
  hasCta: boolean;
  ctaText?: string;
  hasLogo?: boolean;
  logoSrc?: string;
}

@Component({
  selector: 'app-hero-sequence',
  templateUrl: './hero-sequence.component.html',
  styleUrls: ['./hero-sequence.component.scss']
})
export class HeroSequenceComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('sequenceCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('scrollWrapper', { static: true }) scrollWrapperRef!: ElementRef<HTMLDivElement>;
  @ViewChild('stickyContainer', { static: true }) stickyContainerRef!: ElementRef<HTMLDivElement>;

  readonly TOTAL_FRAMES = 240;
  readonly FRAME_PATH = 'assets/sequence/';

  frames: HTMLImageElement[] = [];
  loadedCount = 0;
  loadingProgress = 0;
  isLoading = true;
  currentFrame = 0;

  private ctx!: CanvasRenderingContext2D;
  private canvas!: HTMLCanvasElement;
  private scrollTriggerInstance: ScrollTrigger | null = null;
  private beatTriggers: ScrollTrigger[] = [];
  private resizeObserver: ResizeObserver | null = null;

  textBeats: TextBeat[] = [
    {
      id: 'beat-a',
      title: 'Meet Cluverse',
      subtitle: 'The all-in-one platform for university clubs and associations.',
      alignment: 'center',
      scrollStart: -1,
      scrollEnd: 0.20,
      hasCta: false,
    },
    {
      id: 'beat-b',
      title: 'Run Fair Elections',
      subtitle: 'Transparent internal voting, candidate management, and live results — all in one place.',
      alignment: 'left',
      scrollStart: 0.25,
      scrollEnd: 0.45,
      hasCta: false
    },
    {
      id: 'beat-c',
      title: 'Recruit & Manage Members',
      subtitle: 'From open applications to onboarding — streamline your entire recruitment process.',
      alignment: 'right',
      scrollStart: 0.50,
      scrollEnd: 0.70,
      hasCta: false
    },
    {
      id: 'beat-d',
      title: 'Ready to Lead?',
      subtitle: 'Join the clubs already running smarter.',
      alignment: 'center',
      scrollStart: 0.75,
      scrollEnd: 1.0,
      hasCta: true,
      ctaText: 'Get Started for Free'
    }
  ];

  constructor(private ngZone: NgZone) { }

  ngOnInit(): void {
    this.preloadFrames();
  }

  ngAfterViewInit(): void {
    this.canvas = this.canvasRef.nativeElement;
    const context = this.canvas.getContext('2d');
    if (context) {
      this.ctx = context;
    }

    this.setupResizeObserver();
    this.resizeCanvas();
  }

  ngOnDestroy(): void {
    // Kill all ScrollTrigger instances
    if (this.scrollTriggerInstance) {
      this.scrollTriggerInstance.kill();
    }
    this.beatTriggers.forEach(trigger => trigger.kill());
    ScrollTrigger.getAll().forEach(trigger => trigger.kill());

    // Clear canvas
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // Disconnect resize observer
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }

    // Nullify frame references
    this.frames = [];
  }

  private preloadFrames(): void {
    for (let i = 0; i < this.TOTAL_FRAMES; i++) {
      const img = new Image();
      img.src = `${this.FRAME_PATH}frame_${i}.jpg`;

      img.onload = () => {
        this.loadedCount++;
        this.loadingProgress = Math.round((this.loadedCount / this.TOTAL_FRAMES) * 100);

        if (this.loadedCount === this.TOTAL_FRAMES) {
          // All frames loaded — initialize the experience
          this.ngZone.run(() => {
            setTimeout(() => {
              this.isLoading = false;
              // Small delay to let the loading fade-out animation complete
              setTimeout(() => {
                this.initScrollAnimation();
                this.initTextBeatAnimations();
                this.drawFrame(0);
              }, 600);
            }, 300);
          });
        }
      };

      img.onerror = () => {
        // Count failed loads too so we don't hang
        this.loadedCount++;
        this.loadingProgress = Math.round((this.loadedCount / this.TOTAL_FRAMES) * 100);
      };

      this.frames[i] = img;
    }
  }

  private setupResizeObserver(): void {
    this.resizeObserver = new ResizeObserver(() => {
      this.resizeCanvas();
      if (!this.isLoading && this.frames[this.currentFrame]) {
        this.drawFrame(this.currentFrame);
      }
    });
    this.resizeObserver.observe(this.stickyContainerRef.nativeElement);
  }

  private resizeCanvas(): void {
    const dpr = window.devicePixelRatio || 1;
    const container = this.stickyContainerRef.nativeElement;
    const width = container.clientWidth;
    const height = container.clientHeight;

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    this.ctx?.scale(dpr, dpr);
  }

  private drawFrame(index: number): void {
    if (!this.ctx || !this.frames[index] || !this.frames[index].complete) return;

    const img = this.frames[index];
    const canvasDisplayWidth = this.canvas.width / (window.devicePixelRatio || 1);
    const canvasDisplayHeight = this.canvas.height / (window.devicePixelRatio || 1);

    // Clear the canvas
    this.ctx.clearRect(0, 0, canvasDisplayWidth, canvasDisplayHeight);

    // "Cover" logic — fill the entire viewport
    const scale = Math.max(canvasDisplayWidth / img.naturalWidth, canvasDisplayHeight / img.naturalHeight);
    const scaledWidth = img.naturalWidth * scale;
    const scaledHeight = img.naturalHeight * scale;
    const x = (canvasDisplayWidth - scaledWidth) / 2;
    const y = (canvasDisplayHeight - scaledHeight) / 2;

    this.ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
    this.currentFrame = index;
  }

  private initScrollAnimation(): void {
    const wrapper = this.scrollWrapperRef.nativeElement;

    this.ngZone.runOutsideAngular(() => {
      // Create a dummy tween driven by ScrollTrigger
      const obj = { frame: 0 };

      gsap.to(obj, {
        frame: this.TOTAL_FRAMES - 1,
        snap: 'frame',
        ease: 'none',
        scrollTrigger: {
          trigger: wrapper,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1,
          onUpdate: (self) => {
            const frameIndex = Math.min(
              Math.floor(self.progress * (this.TOTAL_FRAMES - 1)),
              this.TOTAL_FRAMES - 1
            );
            if (frameIndex !== this.currentFrame) {
              this.drawFrame(frameIndex);
            }
          }
        }
      });

      this.scrollTriggerInstance = ScrollTrigger.getAll()[ScrollTrigger.getAll().length - 1];
    });
  }

  private initTextBeatAnimations(): void {
    this.ngZone.runOutsideAngular(() => {
      this.textBeats.forEach((beat) => {
        const element = document.getElementById(beat.id);
        if (!element) return;

        const wrapper = this.scrollWrapperRef.nativeElement;
        const wrapperHeight = wrapper.scrollHeight;

        const startPx = beat.scrollStart * wrapperHeight;
        const endPx = beat.scrollEnd * wrapperHeight;
        const rangePx = endPx - startPx;

        // Fade in over first 10%, hold, fade out over last 10%
        const fadeInEnd = 0.10;
        const fadeOutStart = 0.90;

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: wrapper,
            start: `${startPx}px top`,
            end: `${startPx + rangePx}px top`,
            scrub: 1,
            onEnter: () => { element.style.display = 'flex'; },
            onLeave: () => { if (!beat.hasCta) element.style.display = 'none'; },
            onEnterBack: () => { element.style.display = 'flex'; },
            onLeaveBack: () => { element.style.display = 'none'; },
          }
        });

        tl.fromTo(element,
          { opacity: 0, y: 30 },
          { opacity: 1, y: 0, duration: fadeInEnd, ease: 'power2.out' }
        )
          .to(element, {
            opacity: 1,
            y: 0,
            duration: beat.hasCta ? (1 - fadeInEnd) : (fadeOutStart - fadeInEnd),
          });

        // Only add fade-out for non-CTA beats
        if (!beat.hasCta) {
          tl.to(element, {
            opacity: 0,
            y: -30,
            duration: 1 - fadeOutStart,
            ease: 'power2.in'
          });
        }

        const triggers = ScrollTrigger.getAll();
        this.beatTriggers.push(triggers[triggers.length - 1]);
      });
    });
  }

  getAlignmentClass(alignment: string): string {
    switch (alignment) {
      case 'left': return 'beat-left';
      case 'right': return 'beat-right';
      default: return 'beat-center';
    }
  }
}
