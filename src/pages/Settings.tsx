import { useEffect, useState } from 'react';
import { Key } from 'lucide-react';
import { deleteSetting, getSetting, setSetting } from '../lib/settings';

export default function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const key = await getSetting('openrouter_api_key');
        if (key) setApiKey(key);
      } catch {
        // First run can resolve without a stored key.
      }
    })();
  }, []);

  const saveApiKey = async (value = apiKey) => {
    try {
      const trimmedValue = value.trim();
      if (trimmedValue) {
        await setSetting('openrouter_api_key', trimmedValue);
      } else {
        await deleteSetting('openrouter_api_key');
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="page-shell max-w-5xl">
      <div className="page-header">
        <div className="page-copy">
          <p className="page-kicker">Configuration</p>
          <h2 className="page-title">Settings</h2>
        </div>
      </div>

      <section className="max-w-2xl">
        <div className="panel px-5 py-5 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Key size={20} />
            </div>
            <div>
              <p className="page-kicker">AI Enhancement</p>
              <h3 className="mt-1 text-2xl font-semibold tracking-[-0.06em] text-surface-dark">OpenRouter Key</h3>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input
              type={showKey ? 'text' : 'password'}
              placeholder="sk-or-..."
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              className="field mono flex-1"
            />
            <button onClick={() => setShowKey((current) => !current)} className="action-btn action-btn-secondary">
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button onClick={() => void saveApiKey()} className="action-btn action-btn-primary">
              {saved ? 'Saved' : 'Save Key'}
            </button>
            {apiKey && (
              <button
                onClick={() => {
                  setApiKey('');
                  void saveApiKey('');
                }}
                className="action-btn action-btn-danger"
              >
                Remove Key
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
