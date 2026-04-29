import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * ✅ Validator: Ensure dates are not in the past
 * Both startDate and endDate must be >= current date/time
 */
export function noPastDatesValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) return null;

    const selectedDate = new Date(control.value);
    const now = new Date();

    // Set time to start of today for fair comparison
    now.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);

    if (selectedDate < now) {
      return { pastDate: { value: control.value, message: 'Date cannot be in the past' } };
    }

    return null;
  };
}

/**
 * ✅ Validator: Ensure endDate > startDate
 * Applied at form group level
 */
export function dateRangeValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const formGroup = control as any;

    if (!formGroup.controls) return null;

    const startDate = formGroup.controls['startDate']?.value;
    const endDate = formGroup.controls['endDate']?.value;

    // Only validate if both dates are set
    if (!startDate || !endDate) return null;

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end <= start) {
      return {
        dateRangeMismatch: {
          message: 'End date must be after start date'
        }
      };
    }

    return null;
  };
}

/**
 * ✅ Validator: Ensure quantity doesn't exceed available quantity
 * Max available is passed as parameter
 */
export function maxQuantityValidator(maxAvailable: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) return null;

    const quantity = parseInt(control.value, 10);

    if (isNaN(quantity)) {
      return { invalidQuantity: true };
    }

    if (quantity > maxAvailable) {
      return {
        quantityExceeded: {
          value: control.value,
          max: maxAvailable,
          message: `Maximum ${maxAvailable} unit(s) available`
        }
      };
    }

    return null;
  };
}

/**
 * ✅ Validator: Ensure quantity is at least 1
 */
export function minQuantityValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) return null;

    const quantity = parseInt(control.value, 10);

    if (isNaN(quantity) || quantity < 1) {
      return {
        minQuantity: {
          message: 'Quantity must be at least 1'
        }
      };
    }

    return null;
  };
}
