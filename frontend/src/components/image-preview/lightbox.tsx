import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { useModalTransition } from '../../hooks/useModalTransition';
import { useI18n } from '../../i18n';
import { CLOSED_IMAGE_CONTEXT_MENU, ImageContextMenu } from './context-menu';

interface ImageLightboxProps {
  isOpen: boolean;
  activeImage?: string;
  activeIndex: number;
  total: number;
  zoom: number;
  variant?: 'dark' | 'studio-light';
  minZoom?: number;
  maxZoom?: number;
  onZoomChange: (nextZoom: number) => void;
  onPrev?: () => void;
  onNext?: () => void;
  onClose: () => void;
}

type ExportFormat = 'png' | 'svg' | 'pdf';

export function ImageLightbox({
  isOpen,
  activeImage,
  activeIndex,
  total,
  zoom,
  variant = 'dark',
  minZoom = 0.5,
  maxZoom = 4,
  onZoomChange,
  onPrev,
  onNext,
  onClose,
}: ImageLightboxProps) {
  const { t } = useI18n();
  const { shouldRender, isExiting } = useModalTransition(isOpen, 320);
  const shellRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [transformOrigin, setTransformOrigin] = useState('center center');
  const [contextMenu, setContextMenu] = useState(CLOSED_IMAGE_CONTEXT_MENU);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);
  const isStudioLight = variant === 'studio-light';

  useEffect(() => {
    if (!shouldRender) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setContextMenu(CLOSED_IMAGE_CONTEXT_MENU);
        onClose();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setContextMenu(CLOSED_IMAGE_CONTEXT_MENU);
        onPrev?.();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        setContextMenu(CLOSED_IMAGE_CONTEXT_MENU);
        onNext?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose, onNext, onPrev, shouldRender]);

  useEffect(() => {
    if (!shouldRender || typeof document === 'undefined') {
      return undefined;
    }

    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = 'hidden';

    return () => {
      body.style.overflow = previousOverflow;
    };
  }, [shouldRender]);

  useEffect(() => {
    if (!shouldRender) {
      setTransformOrigin('center center');
      setContextMenu(CLOSED_IMAGE_CONTEXT_MENU);
      setExportingFormat(null);
    }
  }, [shouldRender]);

  useEffect(() => {
    if (!shouldRender) {
      return undefined;
    }

    const frame = window.requestAnimationFrame(() => {
      shellRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [shouldRender]);

  const imageScaleStyle = {
    transform: `scale(${zoom})`,
    transformOrigin,
  };

  const handleStepZoom = (delta: number) => {
    const nextZoom = roundZoom(clampZoom(zoom + delta, minZoom, maxZoom));
    onZoomChange(nextZoom);
  };

  const handleStudioWheel = (event: WheelEvent) => {
    event.preventDefault();

    const image = imageRef.current;
    const viewport = viewportRef.current;
    if (!image || !viewport) {
      return;
    }

    const nextZoom = roundZoom(clampZoom(zoom + (event.deltaY < 0 ? 0.12 : -0.12), minZoom, maxZoom));
    if (nextZoom === zoom) {
      return;
    }

    const imageRect = image.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    const normalizedX = clampRatio((event.clientX - imageRect.left) / Math.max(imageRect.width, 1));
    const normalizedY = clampRatio((event.clientY - imageRect.top) / Math.max(imageRect.height, 1));
    const originX = `${(normalizedX * 100).toFixed(2)}%`;
    const originY = `${(normalizedY * 100).toFixed(2)}%`;
    const pointerOffsetX = event.clientX - viewportRect.left + viewport.scrollLeft;
    const pointerOffsetY = event.clientY - viewportRect.top + viewport.scrollTop;
    const zoomRatio = nextZoom / Math.max(zoom, 0.0001);

    setTransformOrigin(`${originX} ${originY}`);
    onZoomChange(nextZoom);

    window.requestAnimationFrame(() => {
      const nextScrollLeft = pointerOffsetX * zoomRatio - (event.clientX - viewportRect.left);
      const nextScrollTop = pointerOffsetY * zoomRatio - (event.clientY - viewportRect.top);
      viewport.scrollLeft = Math.max(0, nextScrollLeft);
      viewport.scrollTop = Math.max(0, nextScrollTop);
    });
  };

  useEffect(() => {
    if (!shouldRender) {
      return undefined;
    }

    const viewport = viewportRef.current;
    if (!viewport) {
      return undefined;
    }

    const handleNativeWheel = (event: WheelEvent) => {
      handleStudioWheel(event);
    };

    viewport.addEventListener('wheel', handleNativeWheel, { passive: false });

    return () => {
      viewport.removeEventListener('wheel', handleNativeWheel);
    };
  }, [handleStudioWheel, shouldRender, variant]);

  if (!shouldRender || !activeImage) {
    return null;
  }

  const handleContextMenu = (event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault();
    setContextMenu({
      open: true,
      x: event.clientX,
      y: event.clientY,
    });
  };

  const handleExport = async (format: ExportFormat) => {
    if (!activeImage || exportingFormat) {
      return;
    }

    setContextMenu(CLOSED_IMAGE_CONTEXT_MENU);
    setExportingFormat(format);
    try {
      const imageAsset = await readImageAsset(activeImage);
      const dimensions = await resolveImageDimensions(activeImage);
      const filename = buildExportFilename(activeImage, activeIndex, format);

      if (format === 'png') {
        const pngBlob = await createPngBlob(imageAsset, dimensions);
        downloadBlob(pngBlob, filename);
        return;
      }

      if (format === 'svg') {
        const svgBlob = await createSvgBlob(imageAsset, dimensions);
        downloadBlob(svgBlob, filename);
        return;
      }

      const pdfBlob = await createPdfBlob(imageAsset, dimensions);
      downloadBlob(pdfBlob, filename);
    } catch (error) {
      console.error(`Failed to export ${format}`, error);
    } finally {
      setExportingFormat(null);
    }
  };

  if (isStudioLight) {
    return createPortal(
      <>
        <div
          ref={shellRef}
          tabIndex={-1}
          className={`fixed inset-0 z-[180] overflow-hidden bg-white/30 text-text-primary backdrop-blur-2xl ${
            isExiting ? 'animate-fade-out-soft' : 'animate-fade-in-soft'
          }`}
        >
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.94),_rgba(255,255,255,0.5)_42%,_rgba(244,244,245,0.26)_100%)]" />
            <div className="absolute left-[-8%] top-[-10%] h-[38vh] w-[38vw] rounded-full bg-white/55 blur-[110px]" />
            <div className="absolute bottom-[-16%] right-[-6%] h-[42vh] w-[34vw] rounded-full bg-slate-200/45 blur-[120px]" />
          </div>

          <button
            type="button"
            aria-label={t('common.close')}
            onClick={onClose}
            className="absolute inset-0 h-full w-full cursor-default"
          />

          <button
            type="button"
            onClick={onClose}
            className="absolute right-6 top-5 z-20 text-[11px] font-medium uppercase tracking-[0.28em] text-text-secondary/55 transition hover:text-text-primary"
          >
            {t('common.close')}
          </button>

          <div
            ref={viewportRef}
            className="relative z-10 flex h-full w-full items-center justify-center overflow-auto p-4 sm:p-6"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                onClose();
              }
            }}
          >
            <img
              ref={imageRef}
              src={activeImage}
              alt={t('image.lightboxAlt', { index: activeIndex + 1 })}
              className={`max-w-none select-none drop-shadow-[0_30px_80px_rgba(148,163,184,0.28)] ${
                isExiting ? 'animate-fade-out-soft' : 'animate-fade-in-soft'
              }`}
              style={{
                ...imageScaleStyle,
                maxWidth: 'min(98vw, 2200px)',
                maxHeight: 'min(95vh, 1800px)',
              }}
              onClick={(event) => event.stopPropagation()}
              onContextMenu={handleContextMenu}
            />
          </div>
        </div>
        <ImageContextMenu
          state={contextMenu}
          variant={variant}
          title={t('image.exportMenuTitle')}
          items={[
            {
              key: 'export-png',
              label: exportingFormat === 'png' ? t('image.exporting') : t('image.exportPng'),
              busy: exportingFormat === 'png',
              onClick: () => void handleExport('png'),
            },
            {
              key: 'export-svg',
              label: exportingFormat === 'svg' ? t('image.exporting') : t('image.exportSvg'),
              busy: exportingFormat === 'svg',
              onClick: () => void handleExport('svg'),
            },
            {
              key: 'export-pdf',
              label: exportingFormat === 'pdf' ? t('image.exporting') : t('image.exportPdf'),
              busy: exportingFormat === 'pdf',
              onClick: () => void handleExport('pdf'),
            },
          ]}
          onClose={() => setContextMenu(CLOSED_IMAGE_CONTEXT_MENU)}
        />
      </>,
      document.body,
    );
  }

  return createPortal(
    <>
      <div
        ref={shellRef}
        tabIndex={-1}
        className="fixed inset-0 z-[180] flex flex-col bg-black/85 text-white/90 backdrop-blur-sm"
      >
        <button
          type="button"
          aria-label={t('common.close')}
          onClick={onClose}
          className="absolute inset-0 h-full w-full cursor-default"
        />
        <div className="relative z-10 flex items-center justify-between px-5 py-3 text-white/90">
          <div className="text-xs">
            {t('image.lightboxTitle', { current: activeIndex + 1, total })}
          </div>
          <div className="flex items-center gap-3">
            {onPrev ? (
              <button type="button" onClick={onPrev} className="rounded bg-white/15 px-2 py-1 text-xs hover:bg-white/25">
                ←
              </button>
            ) : null}
            {onNext ? (
              <button type="button" onClick={onNext} className="rounded bg-white/15 px-2 py-1 text-xs hover:bg-white/25">
                →
              </button>
            ) : null}
            <button type="button" onClick={() => handleStepZoom(-0.1)} className="rounded bg-white/15 px-2 py-1 text-xs hover:bg-white/25">
              -
            </button>
            <span className="text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => handleStepZoom(0.1)} className="rounded bg-white/15 px-2 py-1 text-xs hover:bg-white/25">
              +
            </button>
            <button type="button" onClick={onClose} className="rounded bg-white/15 px-2 py-1 text-xs hover:bg-white/25">
              {t('common.close')}
            </button>
          </div>
        </div>
        <div
          ref={viewportRef}
          className="relative z-10 flex flex-1 items-center justify-center overflow-auto px-6 pb-6"
        >
          <div
            className="flex h-full w-full items-center justify-center"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                onClose();
              }
            }}
          >
          <img
            ref={imageRef}
            src={activeImage}
            alt={t('image.lightboxAlt', { index: activeIndex + 1 })}
            className="max-w-none"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
            onClick={(event) => event.stopPropagation()}
            onContextMenu={handleContextMenu}
          />
          </div>
        </div>
      </div>
      <ImageContextMenu
        state={contextMenu}
        variant={variant}
        title={t('image.exportMenuTitle')}
        items={[
          {
            key: 'export-png',
            label: exportingFormat === 'png' ? t('image.exporting') : t('image.exportPng'),
            busy: exportingFormat === 'png',
            onClick: () => void handleExport('png'),
          },
          {
            key: 'export-svg',
            label: exportingFormat === 'svg' ? t('image.exporting') : t('image.exportSvg'),
            busy: exportingFormat === 'svg',
            onClick: () => void handleExport('svg'),
          },
          {
            key: 'export-pdf',
            label: exportingFormat === 'pdf' ? t('image.exporting') : t('image.exportPdf'),
            busy: exportingFormat === 'pdf',
            onClick: () => void handleExport('pdf'),
          },
        ]}
        onClose={() => setContextMenu(CLOSED_IMAGE_CONTEXT_MENU)}
      />
    </>,
    document.body,
  );
}

async function readImageAsset(source: string): Promise<{ blob: Blob; mimeType: string; dataUrl: string }> {
  if (source.startsWith('data:')) {
    const [header, base64Part = ''] = source.split(',', 2);
    const mimeType = header.match(/^data:([^;]+)/)?.[1] || 'image/png';
    const bytes = Uint8Array.from(atob(base64Part), (char) => char.charCodeAt(0));
    const blob = new Blob([bytes], { type: mimeType });
    return { blob, mimeType, dataUrl: source };
  }

  const response = await fetch(getAbsoluteUrl(source));
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }
  const blob = await response.blob();
  const mimeType = blob.type || inferMimeTypeFromUrl(source);
  const dataUrl = await blobToDataUrl(blob);
  return { blob, mimeType, dataUrl };
}

async function resolveImageDimensions(source: string): Promise<{ width: number; height: number }> {
  const image = new Image();
  image.decoding = 'async';
  image.src = getAbsoluteUrl(source);

  await image.decode();
  return {
    width: Math.max(1, image.naturalWidth || image.width || 1),
    height: Math.max(1, image.naturalHeight || image.height || 1),
  };
}

async function createPngBlob(
  asset: { blob: Blob; mimeType: string; dataUrl: string },
  dimensions: { width: number; height: number },
): Promise<Blob> {
  if (asset.mimeType === 'image/png') {
    return asset.blob;
  }

  const canvas = document.createElement('canvas');
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D context is unavailable');
  }

  const image = await loadImage(asset.dataUrl);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return await canvasToBlob(canvas, 'image/png');
}

async function createSvgBlob(
  asset: { blob: Blob; mimeType: string; dataUrl: string },
  dimensions: { width: number; height: number },
): Promise<Blob> {
  if (asset.mimeType === 'image/svg+xml') {
    return asset.blob;
  }

  const markup = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${dimensions.width}" height="${dimensions.height}" viewBox="0 0 ${dimensions.width} ${dimensions.height}">`,
    `  <image href="${escapeXmlAttribute(asset.dataUrl)}" width="${dimensions.width}" height="${dimensions.height}" preserveAspectRatio="xMidYMid meet" />`,
    `</svg>`,
  ].join('\n');

  return new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
}

async function createPdfBlob(
  asset: { dataUrl: string },
  dimensions: { width: number; height: number },
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D context is unavailable');
  }

  const image = await loadImage(asset.dataUrl);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.96);
  const jpegBytes = dataUrlToUint8Array(jpegDataUrl);

  const pageWidth = Math.max(1, Math.round((dimensions.width * 72) / 96));
  const pageHeight = Math.max(1, Math.round((dimensions.height * 72) / 96));
  const contentStream = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im0 Do\nQ`;

  const objects: Uint8Array[] = [
    encodeText('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'),
    encodeText('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n'),
    encodeText(
      `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>\nendobj\n`,
    ),
    encodeText(`4 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj\n`),
    concatUint8Arrays([
      encodeText(
        `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${dimensions.width} /Height ${dimensions.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`,
      ),
      jpegBytes,
      encodeText('\nendstream\nendobj\n'),
    ]),
  ];

  const header = encodeText('%PDF-1.4\n%\u00ff\u00ff\u00ff\u00ff\n');
  const bodyParts: Uint8Array[] = [header];
  const offsets: number[] = [0];
  let currentOffset = header.length;

  for (const object of objects) {
    offsets.push(currentOffset);
    bodyParts.push(object);
    currentOffset += object.length;
  }

  const xrefStart = currentOffset;
  const xrefLines = ['xref', `0 ${objects.length + 1}`, '0000000000 65535 f '];
  for (let index = 1; index < offsets.length; index += 1) {
    xrefLines.push(`${String(offsets[index]).padStart(10, '0')} 00000 n `);
  }
  const xref = encodeText(`${xrefLines.join('\n')}\n`);
  const trailer = encodeText(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

  return new Blob([...bodyParts, xref, trailer], { type: 'application/pdf' });
}

function buildExportFilename(source: string, index: number, format: ExportFormat) {
  const base = extractSourceBasename(source) || `image-${index + 1}`;
  const normalizedBase = base.replace(/\.[a-z0-9]+$/i, '');
  return `${normalizedBase}.${format}`;
}

function extractSourceBasename(source: string) {
  if (source.startsWith('data:')) {
    return '';
  }

  try {
    const url = new URL(getAbsoluteUrl(source));
    const raw = url.pathname.split('/').pop() || '';
    return decodeURIComponent(raw);
  } catch {
    return '';
  }
}

function inferMimeTypeFromUrl(source: string) {
  if (/\.svg($|\?)/i.test(source)) {
    return 'image/svg+xml';
  }
  if (/\.jpe?g($|\?)/i.test(source)) {
    return 'image/jpeg';
  }
  if (/\.webp($|\?)/i.test(source)) {
    return 'image/webp';
  }
  if (/\.gif($|\?)/i.test(source)) {
    return 'image/gif';
  }
  return 'image/png';
}

function getAbsoluteUrl(url: string): string {
  if (/^(data:|https?:\/\/)/i.test(url)) {
    return url;
  }
  return new URL(url, window.location.origin).toString();
}

function downloadBlob(blob: Blob, filename: string) {
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob'));
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.readAsDataURL(blob);
  });
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to decode image'));
    image.src = source;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error(`Failed to export canvas as ${type}`));
        return;
      }
      resolve(blob);
    }, type);
  });
}

function dataUrlToUint8Array(dataUrl: string) {
  const base64 = dataUrl.split(',', 2)[1] ?? '';
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

function encodeText(text: string) {
  return new TextEncoder().encode(text);
}

function concatUint8Arrays(parts: Uint8Array[]) {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    merged.set(part, offset);
    offset += part.length;
  }
  return merged;
}

function escapeXmlAttribute(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function clampZoom(value: number, minZoom: number, maxZoom: number) {
  return Math.min(maxZoom, Math.max(minZoom, value));
}

function roundZoom(value: number) {
  return Math.round(value * 100) / 100;
}

function clampRatio(value: number) {
  return Math.min(1, Math.max(0, value));
}
