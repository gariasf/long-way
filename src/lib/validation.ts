// Input validation helpers and constants

export const MAX_NAME_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 2000;
export const MAX_NOTES_LENGTH = 10000;
export const MAX_ARRAY_LENGTH = 100;
export const MAX_TAG_LENGTH = 50;
export const MAX_LINK_LENGTH = 500;

export interface ValidationError {
  field: string;
  message: string;
}

export function validateString(
  value: unknown,
  field: string,
  maxLength: number,
  required = false
): ValidationError | null {
  if (value === undefined || value === null || value === '') {
    if (required) {
      return { field, message: `${field} is required` };
    }
    return null;
  }

  if (typeof value !== 'string') {
    return { field, message: `${field} must be a string` };
  }

  if (value.trim().length > maxLength) {
    return { field, message: `${field} must be at most ${maxLength} characters` };
  }

  return null;
}

export function validateCoordinates(
  lat: unknown,
  lng: unknown
): ValidationError | null {
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return { field: 'coordinates', message: 'Valid coordinates are required' };
  }

  if (!isFinite(lat) || !isFinite(lng)) {
    return { field: 'coordinates', message: 'Coordinates must be finite numbers' };
  }

  if (lat < -90 || lat > 90) {
    return { field: 'latitude', message: 'Latitude must be between -90 and 90' };
  }

  if (lng < -180 || lng > 180) {
    return { field: 'longitude', message: 'Longitude must be between -180 and 180' };
  }

  return null;
}

export function validateStopType(type: unknown): ValidationError | null {
  const validTypes = ['base_camp', 'waypoint', 'stop', 'transport'];
  if (!type || typeof type !== 'string' || !validTypes.includes(type)) {
    return { field: 'type', message: `Type must be one of: ${validTypes.join(', ')}` };
  }
  return null;
}

export function validateTransportType(type: unknown): ValidationError | null {
  if (type === undefined || type === null) return null;

  const validTypes = ['ferry', 'flight', 'train', 'bus'];
  if (typeof type !== 'string' || !validTypes.includes(type)) {
    return { field: 'transport_type', message: `Transport type must be one of: ${validTypes.join(', ')}` };
  }
  return null;
}

export function validateDurationUnit(unit: unknown): ValidationError | null {
  if (unit === undefined || unit === null) return null;

  const validUnits = ['hours', 'nights', 'days'];
  if (typeof unit !== 'string' || !validUnits.includes(unit)) {
    return { field: 'duration_unit', message: `Duration unit must be one of: ${validUnits.join(', ')}` };
  }
  return null;
}

export function validateArray(
  value: unknown,
  field: string,
  maxLength: number,
  itemMaxLength?: number
): ValidationError | null {
  if (value === undefined || value === null) return null;

  if (!Array.isArray(value)) {
    return { field, message: `${field} must be an array` };
  }

  if (value.length > maxLength) {
    return { field, message: `${field} must have at most ${maxLength} items` };
  }

  if (itemMaxLength) {
    for (let i = 0; i < value.length; i++) {
      if (typeof value[i] !== 'string') {
        return { field, message: `${field}[${i}] must be a string` };
      }
      if (value[i].length > itemMaxLength) {
        return { field, message: `${field}[${i}] must be at most ${itemMaxLength} characters` };
      }
    }
  }

  return null;
}

export function validateUUID(value: unknown, field: string): ValidationError | null {
  if (typeof value !== 'string') {
    return { field, message: `${field} must be a string` };
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(value)) {
    return { field, message: `${field} must be a valid UUID` };
  }

  return null;
}

export function validateNumber(
  value: unknown,
  field: string,
  min?: number,
  max?: number
): ValidationError | null {
  if (value === undefined || value === null) return null;

  if (typeof value !== 'number' || !isFinite(value)) {
    return { field, message: `${field} must be a valid number` };
  }

  if (min !== undefined && value < min) {
    return { field, message: `${field} must be at least ${min}` };
  }

  if (max !== undefined && value > max) {
    return { field, message: `${field} must be at most ${max}` };
  }

  return null;
}
