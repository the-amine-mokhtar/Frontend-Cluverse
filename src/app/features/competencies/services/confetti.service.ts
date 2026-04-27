import { Injectable } from '@angular/core';
import confetti from 'canvas-confetti';

@Injectable({
  providedIn: 'root'
})
export class ConfettiService {

  constructor() {}

  /**
   * Lance une explosion de confettis pour célébrer une montée de niveau
   * @param element - Élément HTML autour duquel lancer les confettis (optionnel)
   */
  celebrateLevelUp(element?: HTMLElement): void {
    const defaults = {
      startVelocity: 30,
      spread: 360,
      ticks: 60,
      gravity: 0,
      decay: 0.94,
      origin: { x: 0.5, y: 0.5 }
    };

    // Si un élément est fourni, lancer les confettis autour de cet élément
    if (element) {
      const rect = element.getBoundingClientRect();
      const x = (rect.left + rect.width / 2) / window.innerWidth;
      const y = (rect.top + rect.height / 2) / window.innerHeight;
      defaults.origin = { x, y };
    }

    // Première explosion
    confetti({
      ...defaults,
      particleCount: 100,
      colors: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7']
    });

    // Deuxième explosion après un court délai
    setTimeout(() => {
      confetti({
        ...defaults,
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 }
      });
    }, 200);

    // Troisième explosion
    setTimeout(() => {
      confetti({
        ...defaults,
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 }
      });
    }, 400);
  }

  /**
   * Lance une pluie de confettis continue
   * @param duration - Durée en millisecondes (défaut: 3000ms)
   */
  celebrateWithRain(duration: number = 3000): void {
    const end = Date.now() + duration;

    (function frame() {
      confetti({
        particleCount: 2,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#FFD700', '#FF6B6B', '#4ECDC4']
      });
      confetti({
        particleCount: 2,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#45B7D1', '#96CEB4', '#FFEAA7']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }());
  }

  /**
   * Lance une explosion de confettis dorés (pour les achievements spéciaux)
   */
  celebrateAchievement(): void {
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#FFD700', '#FFA500', '#FFEC8B', '#FFF8DC'],
      shapes: ['circle', 'star'],
      scalar: 1.2
    });
  }

  /**
   * Effet de canon à confettis
   */
  cannonConfetti(): void {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      angle: 270,
      startVelocity: 45,
      colors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#FFD700']
    });
  }
}
