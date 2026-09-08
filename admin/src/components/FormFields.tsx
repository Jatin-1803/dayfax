import { useRef, useState } from 'react';
import { ApiError, getStoredTokens } from '../api/client';
import { ImageCropDialog, type ImageCropShape } from './ImageCropDialog';

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ||
  'http://127.0.0.1:3000/api/v1';

function resolvePublicUrl(path: string | null | undefined) {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const origin = API_BASE.replace(/\/api\/v1$/, '');
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}

interface ImageUploadFieldProps {
  label?: string;
  value: string | null;
  onChange: (imageUrl: string | null) => void;
  disabled?: boolean;
  /** When set, the admin positions the photo before upload so it matches the app. */
  crop?: ImageCropShape;
}

export function ImageUploadField({
  label = 'Image',
  value,
  onChange,
  disabled,
  crop,
}: ImageUploadFieldProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const preview = resolvePublicUrl(value);

  function clearInput() {
    if (inputRef.current) inputRef.current.value = '';
  }

  function onPick(file: File | null) {
    if (!file) return;
    if (crop) {
      setError(null);
      setPendingFile(file);
      return;
    }
    void upload(file);
  }

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const { accessToken } = getStoredTokens();
      const res = await fetch(`${API_BASE}/admin/uploads/image`, {
        method: 'POST',
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        body: form,
      });
      const json = (await res.json()) as {
        success: boolean;
        message?: string;
        data?: { imageUrl: string };
      };
      if (!res.ok || !json.success || !json.data) {
        throw new ApiError(json.message || 'Upload failed', res.status);
      }
      onChange(json.data.imageUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      clearInput();
    }
  }

  return (
    <div className="field">
      <label>{label}</label>
      {preview ? (
        <div className="image-preview-row">
          <img
            src={preview}
            alt=""
            className={crop === 'circle' ? 'image-thumb image-thumb-circle' : 'image-thumb'}
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={disabled || uploading}
            onClick={() => onChange(null)}
          >
            Remove
          </button>
        </div>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled || uploading}
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
      {crop ? (
        <span className="muted">
          Choose a photo, then drag it into place before it is saved.
        </span>
      ) : null}
      {uploading ? <span className="muted">Uploading…</span> : null}
      {error ? <span className="badge badge-danger">{error}</span> : null}
      {pendingFile && crop ? (
        <ImageCropDialog
          file={pendingFile}
          shape={crop}
          onCancel={() => {
            setPendingFile(null);
            clearInput();
          }}
          onConfirm={(file) => {
            setPendingFile(null);
            void upload(file);
          }}
        />
      ) : null}
    </div>
  );
}

export function MoneyInput({
  label,
  valueRupees,
  onChange,
  required,
  min = '0',
}: {
  label: string;
  valueRupees: string;
  onChange: (v: string) => void;
  required?: boolean;
  min?: string;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        type="number"
        min={min}
        step="0.01"
        required={required}
        value={valueRupees}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function rupeesToPaise(rupees: string): number {
  return Math.round(Number(rupees) * 100);
}

export function paiseToRupees(paise: number): string {
  return (paise / 100).toFixed(2);
}

export { resolvePublicUrl };
