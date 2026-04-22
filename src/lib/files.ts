import { isTauriApp } from './platform';

interface PickTextFileOptions {
  accept?: string;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function pickTextFile(options: PickTextFileOptions = {}): Promise<string | null> {
  if (isTauriApp()) {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const { readTextFile } = await import('@tauri-apps/plugin-fs');
    const filePath = await open({
      multiple: false,
      filters: options.accept?.includes('csv')
        ? [{ name: 'CSV', extensions: ['csv'] }]
        : undefined,
    });

    if (!filePath || Array.isArray(filePath)) {
      return null;
    }

    return readTextFile(filePath);
  }

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = options.accept ?? '';
    input.style.display = 'none';

    input.onchange = async () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) {
        resolve(null);
        return;
      }
      resolve(await file.text());
    };

    document.body.appendChild(input);
    input.click();
  });
}

export async function saveText(content: string, defaultName: string, mimeType = 'text/plain;charset=utf-8'): Promise<boolean> {
  if (isTauriApp()) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    const filePath = await save({ defaultPath: defaultName });
    if (!filePath) {
      return false;
    }
    await writeTextFile(filePath, content);
    return true;
  }

  downloadBlob(new Blob([content], { type: mimeType }), defaultName);
  return true;
}

export async function saveBinary(content: ArrayBuffer | Uint8Array, defaultName: string, mimeType = 'application/octet-stream'): Promise<boolean> {
  const bytes = content instanceof Uint8Array ? content : new Uint8Array(content);
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;

  if (isTauriApp()) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    const filePath = await save({ defaultPath: defaultName });
    if (!filePath) {
      return false;
    }
    await writeFile(filePath, bytes);
    return true;
  }

  downloadBlob(new Blob([arrayBuffer], { type: mimeType }), defaultName);
  return true;
}
