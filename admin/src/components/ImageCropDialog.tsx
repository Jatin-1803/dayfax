import { useEffect, useRef, useState } from 'react';
import type { PointerEvent, SyntheticEvent, WheelEvent } from 'react';
import { createPortal } from 'react-dom';

export type ImageCropShape = 'circle' | 'square';

const VIEW = 280;
const OUTPUT = 800;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

interface Frame {
  x: number;
  y: number;
  zoom: number;
}

interface ImageCropDialogProps {
  file: File;
  shape: ImageCropShape;
  onCancel: () => void;
  onConfirm: (file: File) => void;
}

function coverScale(width: number, height: number) {
  return Math.max(VIEW / width, VIEW / height);
}

function clampFrame(width: number, height: number, frame: Frame): Frame {
  const scale = coverScale(width, height) * frame.zoom;
  const renderedW = width * scale;
  const renderedH = height * scale;
  return {
    zoom: frame.zoom,
    x: Math.min(0, Math.max(VIEW - renderedW, frame.x)),
    y: Math.min(0, Math.max(VIEW - renderedH, frame.y)),
  };
}

function centeredFrame(width: number, height: number): Frame {
  const scale = coverScale(width, height);
  return {
    zoom: 1,
    x: (VIEW - width * scale) / 2,
    y: (VIEW - height * scale) / 2,
  };
}

export function ImageCropDialog({ file, shape, onCancel, onConfirm }: ImageCropDialogProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [frame, setFrame] = useState<Frame>({ x: 0, y: 0, zoom: 1 });
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const drag = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  function onImageLoad(event: SyntheticEvent<HTMLImageElement>) {
    const img = event.currentTarget;
    const size = { width: img.naturalWidth, height: img.naturalHeight };
    setNatural(size);
    setFrame(centeredFrame(size.width, size.height));
  }

  function setZoom(nextZoom: number) {
    if (!natural) return;
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
    setFrame((current) => {
      const oldScale = coverScale(natural.width, natural.height) * current.zoom;
      const newScale = coverScale(natural.width, natural.height) * zoom;
      const center = VIEW / 2;
      const imageX = (center - current.x) / oldScale;
      const imageY = (center - current.y) / oldScale;
      return clampFrame(natural.width, natural.height, {
        zoom,
        x: center - imageX * newScale,
        y: center - imageY * newScale,
      });
    });
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!natural) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, originX: frame.x, originY: frame.y };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!natural || !drag.current) return;
    const next = clampFrame(natural.width, natural.height, {
      zoom: frame.zoom,
      x: drag.current.originX + (event.clientX - drag.current.x),
      y: drag.current.originY + (event.clientY - drag.current.y),
    });
    setFrame(next);
  }

  function onPointerUp() {
    drag.current = null;
  }

  function onWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const step = event.deltaY > 0 ? -0.08 : 0.08;
    setZoom(frame.zoom + step);
  }

  async function confirm() {
    if (!objectUrl || !natural) return;
    setExporting(true);
    setError(null);
    try {
      const image = await loadImage(objectUrl);
      const scale = coverScale(natural.width, natural.height) * frame.zoom;
      const sourceX = -frame.x / scale;
      const sourceY = -frame.y / scale;
      const sourceSize = VIEW / scale;
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT;
      canvas.height = OUTPUT;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not prepare the image');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, OUTPUT, OUTPUT);
      ctx.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, OUTPUT, OUTPUT);
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/jpeg', 0.92);
      });
      if (!blob) throw new Error('Could not prepare the image');
      const cropped = new File([blob], 'image.jpg', { type: 'image/jpeg' });
      onConfirm(cropped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not prepare the image');
      setExporting(false);
    }
  }

  const scale = natural ? coverScale(natural.width, natural.height) * frame.zoom : 1;
  const renderedW = natural ? natural.width * scale : VIEW;
  const renderedH = natural ? natural.height * scale : VIEW;
  const hint =
    shape === 'circle'
      ? 'Drag to move, scroll or use the slider to zoom. This circle is how the category will look in the app.'
      : 'Drag to move, scroll or use the slider to zoom. This square is how the product will look in the app.';

  return createPortal(
    <div className="modal-backdrop crop-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="modal crop-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="crop-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="crop-title">Position image</h2>
        <p className="muted crop-hint">{hint}</p>
        <div
          className="crop-stage"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
        >
          {objectUrl ? (
            <img
              src={objectUrl}
              alt=""
              draggable={false}
              className="crop-image"
              style={{ width: renderedW, height: renderedH, left: frame.x, top: frame.y }}
              onLoad={onImageLoad}
            />
          ) : null}
          <div className={`crop-window crop-window-${shape}`} />
        </div>
        <label className="crop-zoom">
          <span>Zoom</span>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={frame.zoom}
            disabled={!natural || exporting}
            onChange={(event) => setZoom(Number(event.target.value))}
          />
        </label>
        {error ? <span className="badge badge-danger">{error}</span> : null}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" disabled={exporting} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn" disabled={!natural || exporting} onClick={() => void confirm()}>
            {exporting ? 'Preparing…' : 'Use this photo'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not read this image'));
    image.src = src;
  });
}
