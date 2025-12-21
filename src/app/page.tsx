'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { TripSelector } from '@/components/TripSelector';
import { StopForm } from '@/components/StopForm';
import { SettingsModal } from '@/components/SettingsModal';
import { Chat } from '@/components/Chat';
import { Trip, Stop } from '@/lib/schemas';

// Dynamic import for Map to avoid SSR issues with Leaflet
const Map = dynamic(() => import('@/components/Map').then(mod => ({ default: mod.Map })), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
      <div className="text-zinc-500">Loading map...</div>
    </div>
  ),
});

type SidebarTab = 'timeline' | 'chat';
type StopFilter = 'all' | 'base_camp' | 'waypoint' | 'stop' | 'transport' | 'optional';

// Helper to open stop in Google Maps
function openInGoogleMaps(stop: Stop) {
  const url = `https://www.google.com/maps/search/?api=1&query=${stop.latitude},${stop.longitude}`;
  window.open(url, '_blank');
}

export default function Home() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);

  // Error state for user feedback
  const [error, setError] = useState<string | null>(null);

  // Loading states for operations
  const [isCreatingTrip, setIsCreatingTrip] = useState(false);
  const [isDeletingStop, setIsDeletingStop] = useState<string | null>(null);
  const [isReordering, setIsReordering] = useState(false);

  // Sidebar tab state
  const [activeTab, setActiveTab] = useState<SidebarTab>('timeline');

  // Filter state
  const [stopFilter, setStopFilter] = useState<StopFilter>('all');
  const [tagFilter, setTagFilter] = useState<string>('');

  // Form state
  const [showStopForm, setShowStopForm] = useState(false);
  const [editingStop, setEditingStop] = useState<Stop | undefined>(undefined);

  // Settings state
  const [showSettings, setShowSettings] = useState(false);

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Get all unique tags from stops
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    stops.forEach(stop => stop.tags?.forEach(tag => tags.add(tag)));
    return Array.from(tags).sort();
  }, [stops]);

  // Filtered stops based on type and tag filters
  const filteredStops = useMemo(() => {
    return stops.filter(stop => {
      // Type filter
      if (stopFilter === 'optional' && !stop.is_optional) return false;
      if (stopFilter !== 'all' && stopFilter !== 'optional' && stop.type !== stopFilter) return false;

      // Tag filter
      if (tagFilter && (!stop.tags || !stop.tags.includes(tagFilter))) return false;

      return true;
    });
  }, [stops, stopFilter, tagFilter]);

  // Fetch all trips
  const fetchTrips = useCallback(async () => {
    try {
      const res = await fetch('/api/trips');
      if (!res.ok) {
        throw new Error('Failed to fetch trips');
      }
      const data = await res.json();
      // Ensure data is an array
      const tripsArray = Array.isArray(data) ? data : [];
      setTrips(tripsArray);

      // Auto-select first trip if none selected (use functional update to avoid stale closure)
      setSelectedTripId(current => {
        if (tripsArray.length > 0 && !current) {
          return tripsArray[0].id;
        }
        return current;
      });
    } catch (err) {
      console.error('Failed to fetch trips:', err);
      setError('Failed to load trips');
    }
  }, []);

  // Fetch stops for selected trip
  const fetchStops = useCallback(async (tripId: string) => {
    try {
      const res = await fetch(`/api/trips/${tripId}`);
      const data = await res.json();
      setStops(data.stops || []);
    } catch (err) {
      console.error('Failed to fetch stops:', err);
      setError('Failed to load stops');
    }
  }, []);

  useEffect(() => {
    fetchTrips().finally(() => setLoading(false));
  }, [fetchTrips]);

  useEffect(() => {
    if (selectedTripId) {
      fetchStops(selectedTripId);
    } else {
      setStops([]);
    }
  }, [selectedTripId, fetchStops]);

  const handleCreateTrip = async (name: string) => {
    setIsCreatingTrip(true);
    setError(null);
    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        throw new Error('Failed to create trip');
      }
      const newTrip = await res.json();
      setTrips(current => [newTrip, ...current]);
      setSelectedTripId(newTrip.id);
    } catch (err) {
      console.error('Failed to create trip:', err);
      setError('Failed to create trip');
    } finally {
      setIsCreatingTrip(false);
    }
  };

  const handleDeleteTrip = async (tripId: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error('Failed to delete trip');
      }
      setTrips(current => {
        const remaining = current.filter(t => t.id !== tripId);
        // Also update selected trip if needed
        setSelectedTripId(currentSelected => {
          if (currentSelected === tripId) {
            return remaining.length > 0 ? remaining[0].id : null;
          }
          return currentSelected;
        });
        return remaining;
      });
    } catch (err) {
      console.error('Failed to delete trip:', err);
      setError('Failed to delete trip');
    }
  };

  const handleStopClick = useCallback((stop: Stop) => {
    setSelectedStop(stop);
  }, []);

  const handleAddStop = useCallback(() => {
    setEditingStop(undefined);
    setShowStopForm(true);
  }, []);

  const handleEditStop = useCallback((stop: Stop) => {
    setEditingStop(stop);
    setShowStopForm(true);
  }, []);

  const handleDeleteStop = useCallback(async (stop: Stop) => {
    if (!confirm(`Delete "${stop.name}"?`)) return;

    // Optimistic update - remove from UI immediately
    const previousStops = stops;
    setStops(current => current.filter(s => s.id !== stop.id));
    setSelectedStop(current => current?.id === stop.id ? null : current);
    setError(null);

    try {
      const res = await fetch(`/api/stops/${stop.id}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error('Failed to delete stop');
      }
      // Success - UI already updated
    } catch (err) {
      // Revert on error
      setStops(previousStops);
      console.error('Failed to delete stop:', err);
      setError('Failed to delete stop');
    }
  }, [stops]);

  const handleStopSaved = useCallback((savedStop: Stop) => {
    setStops(current => {
      const exists = current.some(s => s.id === savedStop.id);
      if (exists) {
        return current.map(s => s.id === savedStop.id ? savedStop : s);
      }
      return [...current, savedStop];
    });
    setShowStopForm(false);
    setEditingStop(undefined);
    setSelectedStop(savedStop);
  }, []);

  const handleFormCancel = useCallback(() => {
    setShowStopForm(false);
    setEditingStop(undefined);
  }, []);

  // Handle stops change from Chat (when Claude modifies stops)
  const handleStopsChange = useCallback((newStops: Stop[]) => {
    setStops(newStops);
  }, []);

  // Drag and drop handlers
  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  }, [draggedIndex]);

  const handleDragEnd = useCallback(async () => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      // Reorder stops locally (optimistic update)
      const newStops = [...stops];
      const [draggedStop] = newStops.splice(draggedIndex, 1);
      newStops.splice(dragOverIndex, 0, draggedStop);
      setStops(newStops);

      // Save to server
      setIsReordering(true);
      setError(null);
      try {
        const res = await fetch(`/api/trips/${selectedTripId}/stops`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stopIds: newStops.map(s => s.id) }),
        });
        if (!res.ok) {
          throw new Error('Failed to reorder stops');
        }
      } catch (err) {
        console.error('Failed to reorder stops:', err);
        setError('Failed to reorder stops');
        // Revert on error
        if (selectedTripId) fetchStops(selectedTripId);
      } finally {
        setIsReordering(false);
      }
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, [draggedIndex, dragOverIndex, stops, selectedTripId, fetchStops]);

  const selectedTrip = trips.find(t => t.id === selectedTripId);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-zinc-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">Long Way</h1>
          <TripSelector
            trips={trips}
            selectedTripId={selectedTripId}
            onSelectTrip={setSelectedTripId}
            onCreateTrip={handleCreateTrip}
            onDeleteTrip={handleDeleteTrip}
          />
        </div>
        <button
          onClick={() => setShowSettings(true)}
          className="p-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          title="Settings"
          aria-label="Open settings"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </header>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 flex items-center justify-between">
          <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700 dark:hover:text-red-300"
            aria-label="Dismiss error"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Main content */}
      <main className="flex flex-1 overflow-hidden">
        {selectedTrip ? (
          <>
            {/* Map area */}
            <div className="flex-1">
              <Map stops={stops} onStopClick={handleStopClick} />
            </div>

            {/* Sidebar */}
            <aside className="w-96 border-l border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden">
              {/* Tabs */}
              <div className="flex border-b border-zinc-200 dark:border-zinc-800">
                <button
                  onClick={() => setActiveTab('timeline')}
                  className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === 'timeline'
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  Timeline
                </button>
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === 'chat'
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  Chat
                </button>
              </div>

              {/* Tab content */}
              {activeTab === 'timeline' ? (
                <>
                  {/* Filter controls */}
                  <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 space-y-2">
                    <div className="flex gap-2">
                      <select
                        value={stopFilter}
                        onChange={(e) => setStopFilter(e.target.value as StopFilter)}
                        className="flex-1 px-2 py-1.5 text-sm border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800"
                      >
                        <option value="all">All types</option>
                        <option value="base_camp">Base Camps</option>
                        <option value="waypoint">Waypoints</option>
                        <option value="stop">Stops</option>
                        <option value="transport">Transport</option>
                        <option value="optional">Optional only</option>
                      </select>
                      {allTags.length > 0 && (
                        <select
                          value={tagFilter}
                          onChange={(e) => setTagFilter(e.target.value)}
                          className="flex-1 px-2 py-1.5 text-sm border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800"
                        >
                          <option value="">All tags</option>
                          {allTags.map(tag => (
                            <option key={tag} value={tag}>{tag}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    {(stopFilter !== 'all' || tagFilter) && (
                      <div className="flex items-center justify-between text-xs text-zinc-500">
                        <span>Showing {filteredStops.length} of {stops.length} stops</span>
                        <button
                          onClick={() => { setStopFilter('all'); setTagFilter(''); }}
                          className="text-blue-500 hover:text-blue-600"
                        >
                          Clear filters
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Timeline content */}
                  <div className="flex-1 overflow-y-auto p-4">
                    {stops.length === 0 ? (
                      <div className="text-center text-zinc-500 dark:text-zinc-400 py-8">
                        <p className="mb-2">No stops yet</p>
                        <p className="text-sm">Add your first stop to start planning</p>
                      </div>
                    ) : filteredStops.length === 0 ? (
                      <div className="text-center text-zinc-500 dark:text-zinc-400 py-8">
                        <p className="mb-2">No stops match filters</p>
                        <button
                          onClick={() => { setStopFilter('all'); setTagFilter(''); }}
                          className="text-sm text-blue-500 hover:text-blue-600"
                        >
                          Clear filters
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredStops.map((stop) => {
                          const originalIndex = stops.findIndex(s => s.id === stop.id);
                          return (
                          <div
                            key={stop.id}
                            draggable
                            onDragStart={() => handleDragStart(originalIndex)}
                            onDragOver={(e) => handleDragOver(e, originalIndex)}
                            onDragEnd={handleDragEnd}
                            onClick={() => setSelectedStop(stop)}
                            className={`group p-3 rounded-lg border cursor-pointer transition-all ${
                              dragOverIndex === originalIndex ? 'border-blue-400 border-2' : ''
                            } ${
                              draggedIndex === originalIndex ? 'opacity-50' : ''
                            } ${
                              selectedStop?.id === stop.id
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : stop.is_optional
                                ? 'border-dashed border-zinc-300 dark:border-zinc-600 hover:border-zinc-400'
                                : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                            } bg-white dark:bg-zinc-800`}
                          >
                            <div className="flex items-start gap-3">
                              {/* Drag handle */}
                              <div className="mt-0.5 cursor-grab active:cursor-grabbing text-zinc-300 hover:text-zinc-500">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM8 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM6 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM14 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM14 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" />
                                </svg>
                              </div>

                              {/* Stop number badge */}
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${
                                stop.type === 'base_camp' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                                stop.type === 'waypoint' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                                stop.type === 'transport' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' :
                                'bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'
                              }`}>
                                {originalIndex + 1}
                              </div>

                              {/* Stop info */}
                              <div className="flex-1 min-w-0">
                                <h3 className="font-medium truncate">{stop.name}</h3>
                                {stop.description && (
                                  <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">
                                    {stop.description}
                                  </p>
                                )}

                                {/* Transport-specific details */}
                                {stop.type === 'transport' && (stop.departure_location || stop.arrival_location) && (
                                  <div className="flex items-center gap-1 mt-1 text-xs text-purple-600 dark:text-purple-400">
                                    {stop.transport_type && (
                                      <span className="capitalize">{stop.transport_type}</span>
                                    )}
                                    {stop.departure_location && stop.arrival_location && (
                                      <>
                                        <span>:</span>
                                        <span>{stop.departure_location}</span>
                                        <span>→</span>
                                        <span>{stop.arrival_location}</span>
                                      </>
                                    )}
                                    {(stop.departure_time || stop.arrival_time) && (
                                      <span className="text-zinc-400 ml-1">
                                        {stop.departure_time && stop.arrival_time
                                          ? `(${stop.departure_time} - ${stop.arrival_time})`
                                          : stop.departure_time
                                          ? `(dep: ${stop.departure_time})`
                                          : `(arr: ${stop.arrival_time})`}
                                      </span>
                                    )}
                                  </div>
                                )}

                                <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400">
                                  <span className="capitalize">{stop.type.replace('_', ' ')}</span>
                                  {stop.day_start && (
                                    <>
                                      <span>•</span>
                                      <span className="text-blue-500 font-medium">
                                        {stop.day_start === stop.day_end || !stop.day_end
                                          ? `Day ${stop.day_start}`
                                          : `Days ${stop.day_start}-${stop.day_end}`}
                                      </span>
                                    </>
                                  )}
                                  {stop.duration_value && stop.duration_unit && (
                                    <>
                                      <span>•</span>
                                      <span>{stop.duration_value} {stop.duration_unit}</span>
                                    </>
                                  )}
                                  {stop.is_optional && (
                                    <>
                                      <span>•</span>
                                      <span className="text-amber-500">Optional</span>
                                    </>
                                  )}
                                </div>

                                {/* Tags */}
                                {stop.tags && stop.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {stop.tags.map(tag => (
                                      <span
                                        key={tag}
                                        onClick={(e) => { e.stopPropagation(); setTagFilter(tag); }}
                                        className="px-1.5 py-0.5 text-xs bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-600"
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Action buttons */}
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={(e) => { e.stopPropagation(); openInGoogleMaps(stop); }}
                                  className="p-1 text-zinc-400 hover:text-green-500"
                                  title="Open in Google Maps"
                                  aria-label={`Open ${stop.name} in Google Maps`}
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleEditStop(stop); }}
                                  className="p-1 text-zinc-400 hover:text-blue-500"
                                  title="Edit"
                                  aria-label={`Edit ${stop.name}`}
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeleteStop(stop); }}
                                  className="p-1 text-zinc-400 hover:text-red-500"
                                  title="Delete"
                                  aria-label={`Delete ${stop.name}`}
                                  disabled={isDeletingStop === stop.id}
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        )})}
                      </div>
                    )}
                  </div>

                  {/* Add stop button */}
                  <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
                    <button
                      onClick={handleAddStop}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Stop
                    </button>
                  </div>
                </>
              ) : (
                <Chat
                  tripId={selectedTripId!}
                  tripName={selectedTrip.name}
                  stops={stops}
                  onStopsChange={handleStopsChange}
                />
              )}
            </aside>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-zinc-500 dark:text-zinc-400">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <p className="text-lg font-medium mb-2">No trip selected</p>
              <p className="text-sm">Create a new trip to get started</p>
            </div>
          </div>
        )}
      </main>

      {/* Stop Form Modal */}
      {showStopForm && selectedTripId && (
        <StopForm
          tripId={selectedTripId}
          stop={editingStop}
          onSave={handleStopSaved}
          onCancel={handleFormCancel}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onDataImported={() => {
            fetchTrips();
            setSelectedTripId(null);
          }}
        />
      )}
    </div>
  );
}
