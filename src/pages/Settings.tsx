import { useState, useEffect } from 'react';
import { Key, Globe, Shield, Info } from 'lucide-react';
import { Store } from '@tauri-apps/plugin-store';

export default function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const store = await Store.load('settings.json');
        const key = await store.get<string>('openrouter_api_key');
        if (key) setApiKey(key);
      } catch { /* first run */ }
    })();
  }, []);

  const saveApiKey = async () => {
    try {
      const store = await Store.load('settings.json');
      if (apiKey.trim()) {
        await store.set('openrouter_api_key', apiKey.trim());
      } else {
        await store.delete('openrouter_api_key');
      }
      await store.save();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Settings</h2>
      <p className="text-sm text-gray-500 mb-6">Configure optional features</p>

      {/* AI Enhancement */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Key size={18} className="text-primary" />
          <h3 className="font-semibold text-gray-900">AI Enhancement (Optional)</h3>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Add your own OpenRouter API key to enable enhanced speech recognition and AI features.
          This is completely optional — the app works fully without it.
        </p>

        <div className="flex gap-2 mb-2">
          <input
            type={showKey ? 'text' : 'password'}
            placeholder="sk-or-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
          <button
            onClick={() => setShowKey(!showKey)}
            className="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {showKey ? 'Hide' : 'Show'}
          </button>
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={saveApiKey}
            className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
          >
            {saved ? '✓ Saved' : 'Save Key'}
          </button>
          {apiKey && (
            <button
              onClick={() => {
                setApiKey('');
                saveApiKey();
              }}
              className="text-sm text-danger hover:underline"
            >
              Remove Key
            </button>
          )}
        </div>
      </div>

      {/* Security Notice */}
      <div className="bg-blue-50 rounded-xl border border-blue-200 p-5 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield size={18} className="text-primary" />
          <h3 className="font-semibold text-blue-900">Security</h3>
        </div>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Your API key is stored locally on your device only</li>
          <li>• AI calls go directly from your device to OpenRouter</li>
          <li>• No proxy server or backend is involved</li>
          <li>• The developer never sees or handles your key</li>
          <li>• The app works fully even without an API key</li>
        </ul>
      </div>

      {/* Offline Notice */}
      <div className="bg-green-50 rounded-xl border border-green-200 p-5 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Globe size={18} className="text-success" />
          <h3 className="font-semibold text-green-900">Offline First</h3>
        </div>
        <ul className="text-sm text-green-800 space-y-1">
          <li>• All data stored locally in SQLite on your device</li>
          <li>• Voice attendance works without internet (native TTS)</li>
          <li>• No cloud dependency for core features</li>
          <li>• AI features require internet + API key (optional)</li>
        </ul>
      </div>

      {/* About */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-2">
          <Info size={18} className="text-gray-500" />
          <h3 className="font-semibold text-gray-900">About Attdn</h3>
        </div>
        <p className="text-sm text-gray-500">
          Voice-first attendance software. Install once, own forever. No subscription, no backend dependency.
        </p>
        <p className="text-xs text-gray-400 mt-2">Version 0.1.0</p>
      </div>
    </div>
  );
}
