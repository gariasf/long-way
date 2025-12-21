'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { TripSelector } from '@/components/TripSelector';
import { StopForm } from '@/components/StopForm';
import { Trip, Stop } from '@/lib/types';

// Dynamic import for Map to avoid SSR issues with Leaflet
const Map = dynamic(() => import('@/components/Map').then(mod => ({ default: mod.Map })), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
      <div className="text-zinc-500">Loading map...</div>
    </div>
  ),
});

export default function Home() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);

  // Form state
  const [showStopForm, setShowStopForm] = useState(false);
  const [editingStop, setEditingStop] = useState<Stop | undefined>(undefined);

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Fetch all trips
  const fetchTrips = useCallback(async () => {
    try {
      const res = await fetch('/api/trips');
      const data = await res.json();
      setTrips(data);

      // Auto-select first trip if none selected
      if (data.length > 0 && !selectedTripId) {
        setSelectedTripId(data[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch trips:', error);
    }
  }, [selectedTripId]);

  // Fetch stops for selected trip
  const fetchStops = useCallback(async (tripId: string) => {
    try {
      const res = await fetch(`/api/trips/${tripId}`);
      const data = await res.json();
      setStops(data.stops || []);
    } catch (error) {
      console.error('Failed to fetch stops:', error);
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
    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const newTrip = await res.json();
      setTrips([newTrip, ...trips]);
      setSelectedTripId(newTrip.id);
    } catch (error) {
      console.error('Failed to create trip:', error);
    }
  };

  const handleDeleteTrip = async (tripId: string) => {
    try {
      await fetch(`/api/trips/${tripId}`, { method: 'DELETE' });
      setTrips(trips.filter(t => t.id !== tripId));
      if (selectedTripId === tripId) {
        const remaining = trips.filter(t => t.id !== tripId);
        setSelectedTripId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (error) {
      console.error('Failed to delete trip:', error);
    }
  };

  const handleStopClick = (stop: Stop) => {
    setSelectedStop(stop);
  };

  const handleAddStop = () => {
    setEditingStop(undefined);
    setShowStopForm(true);
  };

  const handleEditStop = (stop: Stop) => {
    setEditingStop(stop);
    setShowStopForm(true);
  };

  const handleDeleteStop = async (stop: Stop) => {
    if (!confirm(`Delete "${stop.name}"?`)) return;

    try {
      await fetch(`/api/stops/${stop.id}`, { method: 'DELETE' });
      setStops(stops.filter(s => s.id !== stop.id));
      if (selectedStop?.id === stop.id) {
        setSelectedStop(null);
      }
    } catch (error) {
      console.error('Failed to delete stop:', error);
    }
  };

  const handleStopSaved = (savedStop: Stop) => {
    if (editingStop) {
      // Update existing stop
      setStops(stops.map(s => s.id === savedStop.id ? savedStop : s));
    } else {
      // Add new stop
      setStops([...stops, savedStop]);
    }
    setShowStopForm(false);
    setEditingStop(undefined);
    setSelectedStop(savedStop);
  };

  const handleFormCancel = () => {
    setShowStopForm(false);
    setEditingStop(undefined);
  };

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = async () => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      // Reorder stops locally
      const newStops = [...stops];
      const [draggedStop] = newStops.splice(draggedIndex, 1);
      newStops.splice(dragOverIndex, 0, draggedStop);
      setStops(newStops);

      // Save to server
      try {
        await fetch(`/api/trips/${selectedTripId}/stops`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stopIds: newStops.map(s => s.id) }),
        });
      } catch (error) {
        console.error('Failed to reorder stops:', error);
        // Revert on error
        if (selectedTripId) fetchStops(selectedTripId);
      }
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

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
        <button className="p-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </header>

      {/* Main content */}
      <main className="flex flex-1 overflow-hidden">
        {selectedTrip ? (
          <>
            {/* Map area */}
            <div className="flex-1">
              <Map stops={stops} onStopClick={handleStopClick} />
            </div>

            {/* Sidebar */}
            <aside className="w-96 border-l border-zinc-200 dark:border-zinc-800 flex flex-col">
              {/* Tabs */}
              <div className="flex border-b border-zinc-200 dark:border-zinc-800">
                <button className="flex-1 px-4 py-2 text-sm font-medium border-b-2 border-blue-600 text-blue-600">
                  Timeline
                </button>
                <button className="flex-1 px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
                  Chat
                </button>
              </div>

              {/* Timeline content */}
              <div className="flex-1 overflow-y-auto p-4">
                {stops.length === 0 ? (
                  <div className="text-center text-zinc-500 dark:text-zinc-400 py-8">
                    <p className="mb-2">No stops yet</p>
                    <p className="text-sm">Add your first stop to start planning</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {stops.map((stop, index) => (
                      <div
                        key={stop.id}
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                        onClick={() => setSelectedStop(stop)}
                        className={`group p-3 rounded-lg border cursor-pointer transition-all ${
                          dragOverIndex === index ? 'border-blue-400 border-2' : ''
                        } ${
                          draggedIndex === index ? 'opacity-50' : ''
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
                            {index + 1}
                          </div>

                          {/* Stop info */}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium truncate">{stop.name}</h3>
                            {stop.description && (
                              <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">
                                {stop.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400">
                              <span className="capitalize">{stop.type.replace('_', ' ')}</span>
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
                          </div>

                          {/* Action buttons */}
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleEditStop(stop); }}
                              className="p-1 text-zinc-400 hover:text-blue-500"
                              title="Edit"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteStop(stop); }}
                              className="p-1 text-zinc-400 hover:text-red-500"
                              title="Delete"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
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
    </div>
  );
}
