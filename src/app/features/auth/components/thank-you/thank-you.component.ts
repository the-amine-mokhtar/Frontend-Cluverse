import { Component, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { gsap } from 'gsap';

@Component({
  selector: 'app-thank-you',
  templateUrl: './thank-you.component.html',
  styleUrls: ['./thank-you.component.scss']
})
export class ThankYouComponent implements AfterViewInit, OnDestroy {
  public showMessage = false;
  private mainTimeline: gsap.core.Timeline | undefined;

  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    this.initAnimation();
  }
  
  ngOnDestroy(): void {
    if (this.mainTimeline) {
      this.mainTimeline.kill();
    }
  }

  replayAnimation(): void {
    if (this.mainTimeline) {
      this.mainTimeline.restart();
    }
  }

  private initAnimation(): void {
    // SELECTING...
    // T
    const t1 = document.getElementById('t1') as any;
    const t2 = document.getElementById('t2') as any;
    const t2d = [(document.getElementById('t2d1') as any), (document.getElementById('t2d2') as any), (document.getElementById('t2d3') as any)];
    const t1d = [(document.getElementById('t1d1') as any), (document.getElementById('t1d2') as any)]; 

    // H
    const h1 = document.getElementById('h1') as any;
    const h2 = document.getElementById('h2') as any;
    const h2d = [(document.getElementById('h2d1') as any), (document.getElementById('h2d2') as any), (document.getElementById('h2d3') as any)];
    const h3 = document.getElementById('h3') as any;
    const h3d = [(document.getElementById('h3d1') as any), (document.getElementById('h3d2') as any), (document.getElementById('h3d3') as any), (document.getElementById('h3d4') as any)];

    // A
    const a1 = document.getElementById('a1') as any;
    const a2 = document.getElementById('a2') as any;
    const a2d = [(document.getElementById('a2d1') as any), (document.getElementById('a2d2') as any), (document.getElementById('a2d3') as any)];

    // N
    const n1 = document.getElementById('n1') as any;
    const n1d = [(document.getElementById('n1d1') as any), (document.getElementById('n1d2') as any), (document.getElementById('n1d3') as any),
    (document.getElementById('n1d4') as any), (document.getElementById('n1d5') as any)];

    // K
    const k1 = document.getElementById('k1') as any;
    const k1d1 = document.getElementById('k1d1') as any;
    const k2 = document.getElementById('k2') as any;
    const k2d = [(document.getElementById('k2d1') as any), (document.getElementById('k2d2') as any), (document.getElementById('k2d3') as any),
    (document.getElementById('k2d4') as any)];

    // Y
    const y1 = document.getElementById('y1') as any;
    const y1d = [(document.getElementById('y1d1') as any), (document.getElementById('y1d2') as any)];
    const y2 = document.getElementById('y2') as any;
    const y2d = [(document.getElementById('y2d1') as any), (document.getElementById('y2d2') as any)];

    // O
    const o1 = document.getElementById('o1') as any;
    const o1d = [(document.getElementById('o1d1') as any), (document.getElementById('o1d2') as any), (document.getElementById('o1d3') as any), (document.getElementById('o1d4') as any)];

    // U
    const u1 = document.getElementById('u1') as any;
    const u1d = [(document.getElementById('u1d1') as any), (document.getElementById('u1d2') as any)];

    // !
    const e1 = document.getElementById('e1') as any;
    const e2 = document.getElementById('e2') as any;
    const e1d = [(document.getElementById('e1d1') as any), (document.getElementById('e1d2') as any), (document.getElementById('e1d3') as any)];

    // text
    const tspans = document.getElementsByTagName('tspan');
    // underline
    const underlines = [(document.getElementById('underline1') as any), (document.getElementById('underline2') as any), (document.getElementById('underline3') as any), (document.getElementById('underline4') as any)];

    const onAnimComplete = () => {
      this.showMessage = true;
      this.cdr.detectChanges();
    };

    // MAIN TIMELINE
    this.mainTimeline = gsap.timeline({ onComplete: onAnimComplete });

    // Helper functions
    const addLineDecTween = (tl: gsap.core.Timeline, line: any, duration: number, x: number, y: number, delay: number) => {
        tl.to(line.x2.baseVal, { duration, value: x, ease: "power2.inOut" }, delay);
        tl.to(line.y2.baseVal, { duration, value: y, ease: "power2.inOut" }, delay);
        tl.to(line.x1.baseVal, { duration, value: x, ease: "power2.inOut" }, delay + duration);
        tl.to(line.y1.baseVal, { duration, value: y, ease: "power2.inOut" }, delay + duration);
        tl.to(line, { duration: 0.01, opacity: 1 }, delay);
        tl.to(line, { duration: 0.01, opacity: 0 }, delay + (duration * 2));
    };

    const addLineDecOutTween = (tl: gsap.core.Timeline, line: any, duration: number, x1: number, y1: number, x2: number, y2: number, delay: number) => {
      tl.to(line.x1.baseVal, { duration, value: x1, ease: "power2.inOut" }, delay);
      tl.to(line.y1.baseVal, { duration, value: y1, ease: "power2.inOut" }, delay);
      tl.to(line.x2.baseVal, { duration, value: x2, ease: "power2.inOut" }, delay);
      tl.to(line.y2.baseVal, { duration, value: y2, ease: "power2.inOut" }, delay);
      tl.to(line.x1.baseVal, { duration, value: x2, ease: "power2.inOut" }, delay + duration);
      tl.to(line.y1.baseVal, { duration, value: y2, ease: "power2.inOut" }, delay + duration);
      tl.to(line, { duration: 0.01, opacity: 1 }, delay);
      tl.to(line, { duration: 0.01, opacity: 0 }, delay + (duration * 2));
    };

    const addDotDecTween = (tl: gsap.core.Timeline, dot: any, duration: number, r: number, delay: number) => {
        tl.to(dot.rx.baseVal, { duration, value: r, ease: "power1.out" }, delay);
        tl.to(dot.ry.baseVal, { duration, value: r, ease: "power1.out" }, delay);
        tl.to(dot.rx.baseVal, { duration, value: 0, ease: "power1.in" }, delay + duration);
        tl.to(dot.ry.baseVal, { duration, value: 0, ease: "power1.in" }, delay + duration);
    };

    const addUnderlineTween = (tl: gsap.core.Timeline, ul: any, duration: number, x2: number, y2: number, x1: number, y1: number, delay: number) => {
      tl.to(ul.x2.baseVal, { duration, value: x2, ease: "power1.inOut" }, delay);
      tl.to(ul.y2.baseVal, { duration, value: y2, ease: "power1.inOut" }, delay);
      tl.to(ul.x1.baseVal, { duration, value: x1, ease: "power1.inOut" }, delay + duration);
      tl.to(ul.y1.baseVal, { duration, value: y1, ease: "power1.inOut" }, delay + duration);
    };

    const updatePolyline = (line: any, points: any) => {
      if (points.x3) {
        line.setAttribute('points', points.x0+','+points.y0+' '+points.x1+','+points.y1+' '+points.x2+','+points.y2+' '+points.x3+','+points.y3);
      } else {
        line.setAttribute('points', points.x0+','+points.y0+' '+points.x1+','+points.y1+' '+points.x2+','+points.y2);
      }
    };

    // T TIMELINE
    const tline = gsap.timeline();
    tline
      .to(t2.x2.baseVal, { duration: 0.4, value: 200.6, ease: "back.inOut(1.7)" }, 0)
      .to(t2.y2.baseVal, { duration: 0.4, value: 58.6, ease: "back.inOut(1.7)" }, 0)
      .to(t1.y2.baseVal, { duration: 0.5, value: 156.4, ease: "back.inOut(1.7)" }, 0.1)
      .to(t2, { duration: 0.01, opacity: 1 }, 0)
      .to(t1, { duration: 0.01, opacity: 1 }, 0.3);
      addLineDecTween(tline, t2d[0], 0.2, 200, 51, 0.1);
      addLineDecTween(tline, t2d[1], 0.2, 170, 48, 0.2);
      addLineDecTween(tline, t2d[2], 0.2, 150, 44, 0.3);
      addLineDecTween(tline, t1d[0], 0.2, 160, 159, 0.2);
      addLineDecTween(tline, t1d[1], 0.2, 165, 130, 0.3);
    this.mainTimeline.add(tline, 0.5);

    // H TIMELINE
    const hline = gsap.timeline();
    hline
      .to(h1.y2.baseVal, { duration: 0.5, value: 145.4, ease: "back.inOut(1.7)" }, 0)
      .to(h2.x2.baseVal, { duration: 0.4, value: 217.1, ease: "back.inOut(1.7)" }, 0.2)
      .to(h2.y2.baseVal, { duration: 0.4, value: 102.6, ease: "back.inOut(1.7)" }, 0.2)
      .to(h3.y2.baseVal, { duration: 0.5, value: 130.4, ease: "back.inOut(1.7)" }, 0.3)
      .to(h1, { duration: 0.01, opacity: 1 }, 0)
      .to(h2, { duration: 0.01, opacity: 1 }, 0.2)
      .to(h3, { duration: 0.01, opacity: 1 }, 0.3);
      addDotDecTween(hline, h3d[0], 0.25, 2, 0.2);
      addDotDecTween(hline, h3d[1], 0.25, 2, 0.4);
      addDotDecTween(hline, h3d[2], 0.25, 2, 0.6);
      addDotDecTween(hline, h3d[3], 0.25, 2, 0.8);
      addLineDecTween(hline, h2d[0], 0.3, 270, 93, 0.1);
      addLineDecTween(hline, h2d[1], 0.3, 256, 104, 0.2);
      addLineDecTween(hline, h2d[2], 0.3, 242, 114, 0.3);
    this.mainTimeline.add(hline, 0.9);

    // A TIMELINE
    const aline = gsap.timeline();
    if(a1.points[0]) {
      aline
      .to(a1.points[0], { duration: 0.2, x: 305.6, y: 138.6, ease: "power1.in" }, 0)
      .to(a1.points[0], { duration: 0.5, x: 282.6, ease: "back.out(1.7)" }, 0.2) // changed 'a1' label to offset
      .to(a1.points[2], { duration: 0.2, x: 305.6, y: 138.6, ease: "power1.in" }, 0)
      .to(a1.points[2], { duration: 0.5, x: 330.6, ease: "back.out(1.7)" }, 0.2);
    } else {
      const apoly = {x0: 305.6, y0: 51.6, x1: 305.6, y1: 51.6, x2: 305.6, y2: 51.6};
      aline
        .to(apoly, { duration: 0.2, x0: 305.6, y0: 138.6, x2: 305.6, y2: 138.6, ease: "power1.in", onUpdate: () => updatePolyline(a1, apoly) }, 0)
        .to(apoly, { duration: 0.5, x0: 282.6, x2: 330.6, ease: "back.out(1.7)", onUpdate: () => updatePolyline(a1, apoly) }, 0.2);
    }
    aline
      .to(a2.x1.baseVal, { duration: 0.4, value: 319.6, ease: "back.inOut(1.7)" }, 0.2)
      .to(a1, { duration: 0.01, opacity: 1 }, 0)
      .to(a2, { duration: 0.01, opacity: 1 }, 0.2);
      addLineDecOutTween(aline, a2d[0], 0.2, 295, 120, 319, 120, 0.2);
    addLineDecOutTween(aline, a2d[1], 0.2, 293, 127, 321, 127, 0.3);
    addLineDecOutTween(aline, a2d[2], 0.2, 291, 134, 322, 134, 0.4);
    this.mainTimeline.add(aline, 1.2);

    // N TIMELINE
    const nline = gsap.timeline();
    if(n1.points[1]) {
      nline
      .to(n1.points[1], { duration: 0.2, y: 51.6, ease: "power1.out" }, 0)
      .to(n1.points[3], { duration: 0.2, y: 51.6, ease: "power1.out" }, 0)
      .to(n1.points[2], { duration: 0.2, x: 391.6, y: 138.6 }, 0.2)
      .to(n1.points[3], { duration: 0.2, x: 391.6, y: 62.4, ease: "power1.out" }, 0.4)
    } else {
      const npoly = {x0: 352, y0: 147, x1: 358, y1: 147, x2: 363, y2: 147, x3: 365, y3: 74};
      nline
        .to(npoly, { duration: 0.2, y1: 51.6, y3: 51.6, ease: "power1.out", onUpdate: () => updatePolyline(n1, npoly) }, 0)
        .to(npoly, { duration: 0.2, x2: 391.6, x3: 391.6, y2: 138.6, y3: 62.4, ease: "power1.out", onUpdate: () => updatePolyline(n1, npoly) }, 0.2);
    }
    nline.to(n1, { duration: 0.01, opacity: 1 }, 0);
    addLineDecTween(nline, n1d[0], 0.3, 352, 70, 0.1);
    addLineDecTween(nline, n1d[1], 0.3, 358, 102, 0.2);
    addLineDecTween(nline, n1d[2], 0.3, 363, 124, 0.3);
    addLineDecTween(nline, n1d[3], 0.3, 385, 80, 0.4);
    addLineDecTween(nline, n1d[4], 0.3, 385, 74, 0.5);
    this.mainTimeline.add(nline, 1.5);

    // K TIMELINE
    const kline = gsap.timeline();
    if (k2.points[0]) {
      kline
        .to(k2.points[0], { duration: 0.2, x: 452.6, y: 51.6, ease: "back.out(1.7)" }, 0.2)
        .to(k2.points[2], { duration: 0.2, x: 452.6, y: 145.6, ease: "back.out(1.7)" }, 0.3)
    } else {
      const kpoly = {x0: 414.1, y0: 97.6, x1: 414.1, y1: 97.6, x2: 414.1, y2: 97.6};
      kline
        .to(kpoly, { duration: 0.2, x0: 452.6, y0: 51.6, x2: 452.6, y2: 145.6, ease: "back.out(1.7)", onUpdate: () => updatePolyline(k2, kpoly) }, 0.2)
    }
    
    kline
      .to(k1.y2.baseVal, { duration: 0.4, value: 138.4, ease: "back.inOut(1.7)" }, 0)
      .to(k1, { duration: 0.01, opacity: 1 }, 0)
      .to(k2, { duration: 0.01, opacity: 1 }, 0.2);
      addLineDecTween(kline, k1d1, 0.3, 419, 139, 0.1);
      addDotDecTween(kline, k2d[0], 0.25, 2, 0.2);
      addDotDecTween(kline, k2d[1], 0.25, 2, 0.4);
      addDotDecTween(kline, k2d[2], 0.25, 2, 0.6);
      addDotDecTween(kline, k2d[3], 0.25, 2, 0.8);
    this.mainTimeline.add(kline, 1.7);

    // Y TIMELINE
    const yline = gsap.timeline();
    yline
      .to(y1.x2.baseVal, { duration: 0.3, value: 493.6, ease: "back.out(1.7)" }, 0)
      .to(y1.y2.baseVal, { duration: 0.3, value: 112.6, ease: "back.out(1.7)" }, 0)
      .to(y2.x2.baseVal, { duration: 0.4, value: 472.6, ease: "back.out(1.7)" }, 0.15)
      .to(y2.y2.baseVal, { duration: 0.4, value: 168.6, ease: "back.out(1.7)" }, 0.15)
      .to(y1, { duration: 0.01, opacity: 1 }, 0)
      .to(y2, { duration: 0.01, opacity: 1 }, 0.15);
      addLineDecTween(yline, y1d[0], 0.3, 470, 155, 0.3);
      addLineDecTween(yline, y1d[1], 0.3, 478, 120, 0.4);
      addDotDecTween(yline, y2d[0], 0.25, 2, 0.1);
      addDotDecTween(yline, y2d[1], 0.25, 2, 0.2);
    this.mainTimeline.add(yline, 2);

    // O TIMELINE
    const oline = gsap.timeline();
    o1.style.opacity = '1';
    oline
      .to(o1.rx.baseVal, { duration: 0.5, value: 27, ease: "back.out(1.7)" }, 0)
      .to(o1.ry.baseVal, { duration: 0.5, value: 40.5, ease: "back.out(1.7)" }, 0)
      .to(o1d[0].rx.baseVal, { duration: 0.6, value: 27, ease: "back.out(1.7)" }, 0.1)
      .to(o1d[0].ry.baseVal, { duration: 0.6, value: 40.5, ease: "back.out(1.7)" }, 0.1)
      .to(o1d[1].rx.baseVal, { duration: 0.6, value: 27, ease: "power1.out" }, 0.2)
      .to(o1d[1].ry.baseVal, { duration: 0.6, value: 40.5, ease: "power1.out" }, 0.2)
      .to(o1d[2].rx.baseVal, { duration: 0.6, value: 27, ease: "power1.out" }, 0.3)
      .to(o1d[2].ry.baseVal, { duration: 0.6, value: 40.5, ease: "power1.out" }, 0.3)
      .to(o1d[3].rx.baseVal, { duration: 0.6, value: 27, ease: "power1.out" }, 0.4)
      .to(o1d[3].ry.baseVal, { duration: 0.6, value: 40.5, ease: "power1.out" }, 0.4);
    this.mainTimeline.add(oline, 2.2);

    // U TIMELINE
    const uline = gsap.timeline();
    const length = u1.getTotalLength();
    u1.style.opacity = '1';
    u1.style.strokeDasharray = length.toString();
    u1.style.strokeDashoffset = length.toString();
    uline
      .to(u1, { duration: 0.5, strokeDashoffset: 0, ease: "power1.inOut" }, 0);
    addLineDecTween(uline, u1d[0], 0.3, 626, 60, 0.3);
      addLineDecTween(uline, u1d[1], 0.3, 620, 60, 0.4);
    this.mainTimeline.add(uline, 2.4);

    // ! TIMELINE
    const eline = gsap.timeline();
    e2.style.opacity = '1';
    eline
      .to(e2.rx.baseVal, { duration: 0.3, value: 6, ease: "back.out(1.7)" }, 0.3)
      .to(e2.ry.baseVal, { duration: 0.3, value: 6, ease: "back.out(1.7)" }, 0.3)
      .to(e1.x2.baseVal, { duration: 0.3, value: 658.6, ease: "back.inOut(1.7)" }, 0)
      .to(e1.y2.baseVal, { duration: 0.3, value: 130.6, ease: "back.inOut(1.7)" }, 0)
      .to(e1, { duration: 0.01, opacity: 1 }, 0);
    addLineDecTween(eline, e1d[0], 0.3, 653, 118, 0.1);
    addLineDecTween(eline, e1d[1], 0.3, 650, 110, 0.2);
    addLineDecTween(eline, e1d[2], 0.3, 673, 86, 0.3);
    this.mainTimeline.add(eline, 2.6);

    // TEXT TIMELINE
    const textTl = gsap.timeline();
    if(tspans[0] && tspans[0].dx.baseVal[0]) {
      textTl.to(tspans[0].dx.baseVal[0], { duration: 0.6, value: 0, ease: "power3.out" }, 1);
      textTl.to(tspans[0].dy.baseVal[0], { duration: 0.6, value: -1, ease: "power3.out" }, 1);
    } else if (tspans[0]) {
      tspans[0].setAttribute('dx', '0');
      tspans[0].setAttribute('dy', '0');
    }
    
    for (let i = tspans.length - 1; i >= 0; i--) {
        textTl.to(tspans[i], { duration: 0.3, opacity: 1 }, 1 + (tspans.length - 1 - i) * 0.05);
    }

    addUnderlineTween(textTl, underlines[0], 0.5, 664, 153, 370, 167, 0.2);
    addUnderlineTween(textTl, underlines[1], 0.51, 670, 160, 370, 175, 0.3);
    addUnderlineTween(textTl, underlines[2], 0.52, 678, 168, 370, 183, 0.4);
    addUnderlineTween(textTl, underlines[3], 0.53, 686, 176, 370, 191, 0.5);

    this.mainTimeline.add(textTl, 2); 

    this.mainTimeline.timeScale(1.5);
    this.mainTimeline.play();
  }
}
