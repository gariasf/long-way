'use client';

import { useState } from 'react';
import { Trip } from '@/lib/schemas';

interface TripSelectorProps {
  trips: Trip[];
  selectedTripId: string | null;
  onSelectTrip: (tripId: string) => void;
  onCreateTrip: (name: string) => void;
  onDeleteTrip: (tripId: string) => void;
}

export function TripSelector({
  trips,
  selectedTripId,
  onSelectTrip,
  onCreateTrip,
  onDeleteTrip,
}: TripSelectorProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newTripName, setNewTripName] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const selectedTrip = trips.find(t => t.id === selectedTripId);

  const handleCreate = () => {
    if (newTripName.trim()) {
      onCreateTrip(newTripName.trim());
      setNewTripName('');
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreate();
    } else if (e.key === 'Escape') {
      setIsCreating(false);
      setNewTripName('');
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
        <span className="max-w-[200px] truncate">
          {selectedTrip ? selectedTrip.name : 'Select a trip'}
        </span>
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-zinc-200 rounded-lg shadow-lg z-50 dark:bg-zinc-900 dark:border-zinc-700">
          <div className="p-2 border-b border-zinc-200 dark:border-zinc-700">
            {isCreating ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTripName}
                  onChange={(e) => setNewTripName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Trip name..."
                  className="flex-1 px-3 py-1.5 text-sm border border-zinc-300 rounded dark:bg-zinc-800 dark:border-zinc-600"
                  autoFocus
                />
                <button
                  onClick={handleCreate}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
                >
                  Add
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsCreating(true)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New trip
              </button>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto">
            {trips.length === 0 ? (
              <p className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">
                No trips yet. Create one to get started.
              </p>
            ) : (
              trips.map((trip) => (
                <div
                  key={trip.id}
                  className={`flex items-center justify-between px-4 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 ${
                    trip.id === selectedTripId ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <button
                    onClick={() => {
                      onSelectTrip(trip.id);
                      setIsOpen(false);
                    }}
                    className="flex-1 text-left"
                  >
                    <span className="text-sm font-medium">{trip.name}</span>
                    {trip.description && (
                      <span className="block text-xs text-zinc-500 dark:text-zinc-400 truncate">
                        {trip.description}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete "${trip.name}"?`)) {
                        onDeleteTrip(trip.id);
                      }
                    }}
                    className="p-1 text-zinc-400 hover:text-red-500"
                    title="Delete trip"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
