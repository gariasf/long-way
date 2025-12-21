'use client';

import { useState, useEffect } from 'react';

interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [keyPreview, setKeyPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-md m-4">
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

        <div className="p-4 space-y-4">
          {isLoading ? (
            <div className="text-center text-zinc-500 py-4">Loading...</div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Anthropic API Key
                </label>
                <p className="text-xs text-zinc-500 mb-2">
                  Required for Claude chat integration. Get your key from{' '}
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
              </div>

              {message && (
                <div className={`p-3 text-sm rounded-lg ${
                  message.type === 'success'
                    ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                    : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                }`}>
                  {message.text}
                </div>
              )}

              <div className="flex gap-3">
                {hasApiKey && (
                  <button
                    onClick={handleClear}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20 disabled:opacity-50"
                  >
                    Clear Key
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={isSaving || !apiKey.trim()}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : hasApiKey ? 'Update API Key' : 'Save API Key'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
