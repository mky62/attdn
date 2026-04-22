import { isTauriApp } from './platform';

const SETTINGS_STORAGE_KEY = 'attdn.settings';
const ENV_OPENROUTER_KEY = import.meta.env.VITE_OPENROUTER_API_KEY?.trim() || null;

type SettingsMap = Record<string, string>;

function readBrowserSettings(): SettingsMap {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SettingsMap) : {};
  } catch {
    return {};
  }
}

function writeBrowserSettings(settings: SettingsMap): void {
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export async function getSetting(key: string): Promise<string | null> {
  if (isTauriApp()) {
    const { Store } = await import('@tauri-apps/plugin-store');
    const store = await Store.load('settings.json');
    const value = await store.get<string>(key);
    return value?.trim() || null;
  }

  const browserValue = readBrowserSettings()[key] ?? null;
  if (browserValue) {
    return browserValue;
  }

  if (key === 'openrouter_api_key') {
    return ENV_OPENROUTER_KEY;
  }

  return null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  if (isTauriApp()) {
    const { Store } = await import('@tauri-apps/plugin-store');
    const store = await Store.load('settings.json');
    await store.set(key, value);
    await store.save();
    return;
  }

  const settings = readBrowserSettings();
  settings[key] = value;
  writeBrowserSettings(settings);
}

export async function deleteSetting(key: string): Promise<void> {
  if (isTauriApp()) {
    const { Store } = await import('@tauri-apps/plugin-store');
    const store = await Store.load('settings.json');
    await store.delete(key);
    await store.save();
    return;
  }

  const settings = readBrowserSettings();
  delete settings[key];
  writeBrowserSettings(settings);
}
