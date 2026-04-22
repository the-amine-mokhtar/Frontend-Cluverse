declare module 'quagga' {
  interface QuaggaInit {
    inputStream?: {
      type?: string;
      constraints?: {
        width?: { ideal?: number; min?: number };
        height?: { ideal?: number; min?: number };
        facingMode?: string;
      };
      target?: HTMLElement | null;
    };
    decoder?: {
      readers?: string[];
      debug?: {
        showCanvas?: boolean;
        showPatternLabel?: boolean;
        showLines?: boolean;
        showDecoders?: boolean;
      };
    };
    locate?: boolean;
    orientation?: string;
    frequency?: number;
    numOfWorkers?: number;
    willReadFrequently?: boolean;
  }

  interface DetectionResult {
    codeResult?: {
      code?: string;
      format?: string;
    };
  }

  interface Quagga {
    init(config: QuaggaInit, callback?: (error?: Error) => void): void;
    start(): void;
    stop(): void;
    onDetected(callback: (result: DetectionResult) => void): void;
    offDetected(callback: (result: DetectionResult) => void): void;
  }

  const Quagga: Quagga;
  export default Quagga;
}
