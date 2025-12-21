'use client';

import { useState, useEffect, useRef } from 'react';
import { Stop, StopType, DurationUnit, TransportType, CreateStopRequest, UpdateStopRequest } from '@/lib/schemas';

interface StopFormProps {
  tripId: string;
  stop?: Stop; // If provided, we're editing
  onSave: (stop: Stop) => void;
  onCancel: () => void;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

// Parse coordinates from Google Maps URL
function parseGoogleMapsUrl(url: string): { lat: number; lng: number } | null {
  // Format: https://www.google.com/maps/place/.../@41.3851,2.1734,17z/...
  const atMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (atMatch) {
    return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  }

  // Format: https://www.google.com/maps?q=41.3851,2.1734
  const qMatch = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (qMatch) {
    return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
  }

  // Format: https://maps.google.com/maps?ll=41.3851,2.1734
  const llMatch = url.match(/[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (llMatch) {
    return { lat: parseFloat(llMatch[1]), lng: parseFloat(llMatch[2]) };
  }

  return null;
}

// Parse raw coordinate input
function parseCoordinates(input: string): { lat: number; lng: number } | null {
  // Format: "41.3851, 2.1734" or "41.3851 2.1734"
  const match = input.match(/(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/);
  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }
  return null;
}

export function StopForm({ tripId, stop, onSave, onCancel }: StopFormProps) {
  const isEditing = !!stop;

  // Form state
  const [name, setName] = useState(stop?.name || '');
  const [type, setType] = useState<StopType>(stop?.type || 'stop');
  const [description, setDescription] = useState(stop?.description || '');
  const [latitude, setLatitude] = useState(stop?.latitude?.toString() || '');
  const [longitude, setLongitude] = useState(stop?.longitude?.toString() || '');
  const [durationValue, setDurationValue] = useState(stop?.duration_value?.toString() || '');
  const [durationUnit, setDurationUnit] = useState<DurationUnit>(stop?.duration_unit || 'nights');
  const [isOptional, setIsOptional] = useState(stop?.is_optional || false);
  const [notes, setNotes] = useState(stop?.notes || '');

  // Transport-specific
  const [transportType, setTransportType] = useState<TransportType | ''>(stop?.transport_type || '');
  const [departureTime, setDepartureTime] = useState(stop?.departure_time || '');
  const [arrivalTime, setArrivalTime] = useState(stop?.arrival_time || '');
  const [departureLocation, setDepartureLocation] = useState(stop?.departure_location || '');
  const [arrivalLocation, setArrivalLocation] = useState(stop?.arrival_location || '');

  // Location search state
  const [locationQuery, setLocationQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Saving state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Debounced location search
  useEffect(() => {
    if (locationQuery.length < 3) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    // Check if it's a Google Maps URL
    if (locationQuery.includes('google.com/maps') || locationQuery.includes('maps.google.com')) {
      const coords = parseGoogleMapsUrl(locationQuery);
      if (coords) {
        setLatitude(coords.lat.toString());
        setLongitude(coords.lng.toString());
        setLocationQuery('');
        setShowResults(false);
        return;
      }
    }

    // Check if it's raw coordinates
    const coords = parseCoordinates(locationQuery);
    if (coords) {
      setLatitude(coords.lat.toString());
      setLongitude(coords.lng.toString());
      setLocationQuery('');
      setShowResults(false);
      return;
    }

    // Otherwise, search via Nominatim
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationQuery)}&limit=5`,
          { headers: { 'User-Agent': 'LongWay/1.0' } }
        );
        const data: NominatimResult[] = await res.json();
        setSearchResults(data);
        setShowResults(true);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [locationQuery]);

  const selectLocation = (result: NominatimResult) => {
    setLatitude(result.lat);
    setLongitude(result.lon);
    if (!name) {
      // Use first part of display name as stop name
      setName(result.display_name.split(',')[0].trim());
    }
    setLocationQuery('');
    setShowResults(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!latitude || !longitude) {
      setError('Location is required');
      return;
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lng)) {
      setError('Invalid coordinates');
      return;
    }
    if (lat < -90 || lat > 90) {
      setError('Latitude must be between -90 and 90');
      return;
    }
    if (lng < -180 || lng > 180) {
      setError('Longitude must be between -180 and 180');
      return;
    }

    setIsSaving(true);

    try {
      const stopData: CreateStopRequest | UpdateStopRequest = {
        name: name.trim(),
        type,
        description: description.trim() || undefined,
        latitude: lat,
        longitude: lng,
        duration_value: durationValue ? parseInt(durationValue) : undefined,
        duration_unit: durationValue ? durationUnit : undefined,
        is_optional: isOptional,
        notes: notes.trim() || undefined,
        transport_type: type === 'transport' && transportType ? transportType as TransportType : undefined,
        departure_time: type === 'transport' ? departureTime || undefined : undefined,
        arrival_time: type === 'transport' ? arrivalTime || undefined : undefined,
        departure_location: type === 'transport' ? departureLocation || undefined : undefined,
        arrival_location: type === 'transport' ? arrivalLocation || undefined : undefined,
      };

      let res: Response;
      if (isEditing && stop) {
        res = await fetch(`/api/stops/${stop.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(stopData),
        });
      } else {
        res = await fetch(`/api/trips/${tripId}/stops`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(stopData),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save stop');
      }

      const savedStop = await res.json();
      onSave(savedStop);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save stop');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto m-4">
        <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700 px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {isEditing ? 'Edit Stop' : 'Add Stop'}
          </h2>
          <button
            onClick={onCancel}
            className="p-1 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            aria-label="Close form"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800"
              placeholder="e.g., Bergen City Center"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as StopType)}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800"
            >
              <option value="base_camp">Base Camp (multi-night anchor)</option>
              <option value="waypoint">Waypoint (overnight stop)</option>
              <option value="stop">Stop (hours only)</option>
              <option value="transport">Transport (ferry/flight/train)</option>
            </select>
          </div>

          {/* Location Search */}
          <div className="relative">
            <label className="block text-sm font-medium mb-1">Location *</label>
            <input
              type="text"
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800"
              placeholder="Search, paste Google Maps link, or enter coordinates"
            />
            {isSearching && (
              <div className="absolute right-3 top-9 text-zinc-400">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            )}
            {showResults && searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {searchResults.map((result) => (
                  <button
                    key={result.place_id}
                    type="button"
                    onClick={() => selectLocation(result)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 border-b border-zinc-100 dark:border-zinc-700 last:border-0"
                  >
                    {result.display_name}
                  </button>
                ))}
              </div>
            )}
            {latitude && longitude && (
              <p className="mt-1 text-xs text-zinc-500">
                Coordinates: {parseFloat(latitude).toFixed(4)}, {parseFloat(longitude).toFixed(4)}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800"
              placeholder="Short description of why this stop matters"
            />
          </div>

          {/* Duration */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Duration</label>
              <input
                type="number"
                value={durationValue}
                onChange={(e) => setDurationValue(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800"
                placeholder="e.g., 2"
                min="0"
              />
            </div>
            <div className="w-28">
              <label className="block text-sm font-medium mb-1">&nbsp;</label>
              <select
                value={durationUnit}
                onChange={(e) => setDurationUnit(e.target.value as DurationUnit)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800"
              >
                <option value="hours">hours</option>
                <option value="nights">nights</option>
                <option value="days">days</option>
              </select>
            </div>
          </div>

          {/* Transport-specific fields */}
          {type === 'transport' && (
            <div className="space-y-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div>
                <label className="block text-sm font-medium mb-1">Transport Type</label>
                <select
                  value={transportType}
                  onChange={(e) => setTransportType(e.target.value as TransportType | '')}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800"
                >
                  <option value="">Select type...</option>
                  <option value="ferry">Ferry</option>
                  <option value="flight">Flight</option>
                  <option value="train">Train</option>
                  <option value="bus">Bus</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Departure</label>
                  <input
                    type="text"
                    value={departureLocation}
                    onChange={(e) => setDepartureLocation(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800"
                    placeholder="e.g., Hirtshals Port"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Arrival</label>
                  <input
                    type="text"
                    value={arrivalLocation}
                    onChange={(e) => setArrivalLocation(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800"
                    placeholder="e.g., Kristiansand"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Departure Time</label>
                  <input
                    type="time"
                    value={departureTime}
                    onChange={(e) => setDepartureTime(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Arrival Time</label>
                  <input
                    type="time"
                    value={arrivalTime}
                    onChange={(e) => setArrivalTime(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Optional checkbox */}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isOptional}
              onChange={(e) => setIsOptional(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-300"
            />
            <span className="text-sm">Optional stop (serendipity candidate)</span>
          </label>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 resize-none"
              rows={3}
              placeholder="Additional notes (markdown supported)"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 text-sm font-medium border border-zinc-300 dark:border-zinc-600 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Stop'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
