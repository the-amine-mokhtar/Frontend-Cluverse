import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SponsorFileUtilsService {
  readonly maxFileSizeBytes = 50 * 1024 * 1024;
  readonly acceptedMimeTypes = ['application/pdf', 'text/plain'];

  isAllowedType(file: File): boolean {
    return file.type.startsWith('image/') || this.acceptedMimeTypes.includes(file.type);
  }

  validateFile(file: File): string | null {
    if (!this.isAllowedType(file)) {
      return `Unsupported file type: ${file.type || 'unknown'}`;
    }
    if (file.size > this.maxFileSizeBytes) {
      return `${file.name} exceeds 50MB limit.`;
    }
    return null;
  }

  formatSize(sizeBytes: number): string {
    if (sizeBytes < 1024) {
      return `${sizeBytes} B`;
    }
    const kb = sizeBytes / 1024;
    if (kb < 1024) {
      return `${kb.toFixed(1)} KB`;
    }
    return `${(kb / 1024).toFixed(1)} MB`;
  }
}
