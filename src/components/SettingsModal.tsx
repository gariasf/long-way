'use client';

import { useState, useEffect, useRef } from 'react';

interface SettingsModalProps {
  onClose: () => void;
  onDataImported?: () => void;
}

export function SettingsModal({ onClose, onDataImported }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [keyPreview, setKeyPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/settings', { signal: controller.signal })
      .then(res => res.json())
      .then(data => {
        setHasApiKey(data.hasApiKey);
        setKeyPreview(data.keyPreview);
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error('Failed to load settings:', err);
        }
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save settings');
      }

      setHasApiKey(true);
      setKeyPreview(apiKey.trim().slice(0, 7) + '...' + apiKey.trim().slice(-4));
      setApiKey('');
      setMessage({ type: 'success', text: 'API key saved successfully' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to save API key' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: '' }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to clear settings');
      }

      setApiKey('');
      setHasApiKey(false);
      setKeyPreview(null);
      setMessage({ type: 'success', text: 'API key cleared' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to clear API key' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async () => {
    setMessage(null);
    try {
      const res = await fetch('/api/export');
      if (!res.ok) throw new Error('Failed to export data');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `longway-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setMessage({ type: 'success', text: 'Data exported successfully' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to export data' });
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setMessage(null);

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, mode: importMode }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Failed to import data');
      }

      setMessage({ type: 'success', text: result.message });
      onDataImported?.();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to import data' });
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-md m-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-6">
          {isLoading ? (
            <div className="text-center text-zinc-500 py-4">Loading...</div>
          ) : (
            <>
              {/* API Key Section */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Claude API</h3>
                <p className="text-xs text-zinc-500 mb-2">
                  Required for AI chat. Get your key from{' '}
                  <a
                    href="https://console.anthropic.com/settings/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    console.anthropic.com
                  </a>
                </p>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800"
                  placeholder="sk-ant-..."
                />
                {hasApiKey && keyPreview && (
                  <p className="mt-1 text-xs text-zinc-500">
                    Current key: {keyPreview}
                  </p>
                )}
                <div className="flex gap-2 mt-2">
                  {hasApiKey && (
                    <button
                      onClick={handleClear}
                      disabled={isSaving}
                      className="px-3 py-1.5 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20 disabled:opacity-50"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={isSaving || !apiKey.trim()}
                    className="flex-1 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : hasApiKey ? 'Update Key' : 'Save Key'}
                  </button>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-zinc-200 dark:border-zinc-700" />

              {/* Data Management Section */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Data Management</h3>
                <p className="text-xs text-zinc-500 mb-3">
                  Export your trips to back up or migrate to another instance.
                </p>

                {/* Export */}
                <button
                  onClick={handleExport}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-600 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 mb-3"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export All Data
                </button>

                {/* Import */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-zinc-500">Import mode:</label>
                    <select
                      value={importMode}
                      onChange={(e) => setImportMode(e.target.value as 'merge' | 'replace')}
                      className="text-xs px-2 py-1 border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800"
                    >
                      <option value="merge">Merge (add new trips)</option>
                      <option value="replace">Replace (overwrite all)</option>
                    </select>
                  </div>
                  <button
                    onClick={handleImportClick}
                    disabled={isImporting}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-600 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    {isImporting ? 'Importing...' : 'Import Data'}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  {importMode === 'replace' && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Warning: Replace mode will delete all existing trips!
                    </p>
                  )}
                </div>
              </div>

              {/* Message */}
              {message && (
                <div className={`p-3 text-sm rounded-lg ${
                  message.type === 'success'
                    ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                    : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                }`}>
                  {message.text}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
