import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReferenceImage } from '../../types/api';
import { uploadReferenceImage } from '../../lib/api';
import { useI18n } from '../../i18n';
import { CanvasPreviewStrip } from './CanvasPreviewStrip';
import { CanvasToolbar } from './CanvasToolbar';
import { createPage, DEFAULT_COLOR, DEFAULT_WIDTH, ERASER_RADIUS, CANVAS_EXPORT_HEIGHT, CANVAS_EXPORT_WIDTH } from './constants';
import { eraseStrokeWithCircle, findStrokeAtPoint } from './canvas-geometry';
import { dataUrlToFile, drawGrid, drawStroke, getCanvasPoint, renderPageToDataUrl } from './canvas-render';
import type { CanvasPage, Point, PreviewImage, StrokeObject, ToolMode } from './types';

interface CanvasWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (images: ReferenceImage[]) => void;
}

function eraseAtPoint(strokes: StrokeObject[], point: Point, radius: number): StrokeObject[] {
  return strokes.flatMap((stroke) => eraseStrokeWithCircle(stroke, point, radius));
}

export function CanvasWorkspaceModal({ isOpen, onClose, onComplete }: CanvasWorkspaceModalProps) {
  const { t } = useI18n();
  const [pages, setPages] = useState<CanvasPage[]>([createPage()]);
  const [activePageId, setActivePageId] = useState<string>(() => pages[0].id);
  const [tool, setTool] = useState<ToolMode>('pen');
  const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(false);
  const [isBrushSettingsOpen, setIsBrushSettingsOpen] = useState(false);
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [strokeWidth, setStrokeWidth] = useState(DEFAULT_WIDTH);
  const [selectedStrokeId, setSelectedStrokeId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false);
  const [isPreviewConfirmOpen, setIsPreviewConfirmOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeStrokeIdRef = useRef<string | null>(null);
  const dragOriginRef = useRef<Point | null>(null);
  const isErasingRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const firstPage = createPage();
    setPages([firstPage]);
    setActivePageId(firstPage.id);
    setTool('pen');
    setIsToolbarCollapsed(false);
    setIsBrushSettingsOpen(false);
    setColor(DEFAULT_COLOR);
    setStrokeWidth(DEFAULT_WIDTH);
    setSelectedStrokeId(null);
    setIsDirty(false);
    setIsDiscardConfirmOpen(false);
    setIsPreviewConfirmOpen(false);
    setIsExporting(false);
    setPreviewImages([]);
    activeStrokeIdRef.current = null;
    dragOriginRef.current = null;
    isErasingRef.current = false;
  }, [isOpen]);

  const activePageIndex = useMemo(() => pages.findIndex((page) => page.id === activePageId), [activePageId, pages]);
  const activePage = activePageIndex >= 0 ? pages[activePageIndex] : pages[0];

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activePage) {
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    drawGrid(ctx, CANVAS_EXPORT_WIDTH, CANVAS_EXPORT_HEIGHT);
    activePage.strokes.forEach((stroke) => drawStroke(ctx, stroke));

    if (selectedStrokeId) {
      const selected = activePage.strokes.find((stroke) => stroke.id === selectedStrokeId);
      if (selected) {
        const xs = selected.points.map((point) => point.x);
        const ys = selected.points.map((point) => point.y);
        const minX = Math.min(...xs) - selected.width - 12;
        const maxX = Math.max(...xs) + selected.width + 12;
        const minY = Math.min(...ys) - selected.width - 12;
        const maxY = Math.max(...ys) + selected.width + 12;
        ctx.save();
        ctx.strokeStyle = 'rgba(10, 132, 255, 0.72)';
        ctx.setLineDash([14, 8]);
        ctx.lineWidth = 2;
        ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
        ctx.restore();
      }
    }

    if (tool === 'eraser') {
      ctx.save();
      ctx.strokeStyle = 'rgba(30, 30, 30, 0.18)';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(80, 80, ERASER_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }, [activePage, selectedStrokeId, tool]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  const updateActivePage = useCallback((updater: (page: CanvasPage) => CanvasPage) => {
    setPages((prev) => prev.map((page) => (page.id === activePageId ? updater(page) : page)));
  }, [activePageId]);

  const applyErase = useCallback((point: Point) => {
    updateActivePage((page) => ({
      ...page,
      strokes: eraseAtPoint(page.strokes, point, ERASER_RADIUS),
    }));
    setSelectedStrokeId(null);
    setIsDirty(true);
  }, [updateActivePage]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !activePage) {
      return;
    }

    const point = getCanvasPoint(event, canvas);
    canvas.setPointerCapture(event.pointerId);

    if (tool === 'pen') {
      const strokeId = crypto.randomUUID();
      activeStrokeIdRef.current = strokeId;
      const newStroke: StrokeObject = {
        id: strokeId,
        color,
        width: strokeWidth,
        points: [point],
      };
      updateActivePage((page) => ({ ...page, strokes: [...page.strokes, newStroke] }));
      setSelectedStrokeId(strokeId);
      setIsDirty(true);
      return;
    }

    if (tool === 'eraser') {
      isErasingRef.current = true;
      applyErase(point);
      return;
    }

    if (tool === 'select') {
      const target = findStrokeAtPoint(activePage.strokes, point);
      if (!target) {
        setSelectedStrokeId(null);
        activeStrokeIdRef.current = null;
        return;
      }
      setSelectedStrokeId(target.id);
      activeStrokeIdRef.current = target.id;
      dragOriginRef.current = point;
    }
  }, [activePage, applyErase, color, strokeWidth, tool, updateActivePage]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !activePage) {
      return;
    }

    const point = getCanvasPoint(event, canvas);

    if (tool === 'pen' && activeStrokeIdRef.current) {
      updateActivePage((page) => ({
        ...page,
        strokes: page.strokes.map((stroke) => (
          stroke.id === activeStrokeIdRef.current
            ? { ...stroke, points: [...stroke.points, point] }
            : stroke
        )),
      }));
      return;
    }

    if (tool === 'eraser' && isErasingRef.current) {
      applyErase(point);
      return;
    }

    if (tool === 'select' && activeStrokeIdRef.current && dragOriginRef.current) {
      const deltaX = point.x - dragOriginRef.current.x;
      const deltaY = point.y - dragOriginRef.current.y;
      dragOriginRef.current = point;
      updateActivePage((page) => ({
        ...page,
        strokes: page.strokes.map((stroke) => (
          stroke.id === activeStrokeIdRef.current
            ? {
                ...stroke,
                points: stroke.points.map((value) => ({ x: value.x + deltaX, y: value.y + deltaY })),
              }
            : stroke
        )),
      }));
      setIsDirty(true);
    }
  }, [activePage, applyErase, tool, updateActivePage]);

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas && canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    if (tool !== 'select') {
      activeStrokeIdRef.current = null;
    }
    dragOriginRef.current = null;
    isErasingRef.current = false;
  }, [tool]);

  const handleAddPage = useCallback(() => {
    const page = createPage();
    setPages((prev) => [...prev, page]);
    setActivePageId(page.id);
    setSelectedStrokeId(null);
    setIsDirty(true);
  }, []);

  const handleDeletePage = useCallback(() => {
    if (pages.length <= 1) {
      const firstPage = createPage();
      setPages([firstPage]);
      setActivePageId(firstPage.id);
      setSelectedStrokeId(null);
      setIsDirty(true);
      return;
    }

    const nextPages = pages.filter((page) => page.id !== activePageId);
    const nextActive = nextPages[Math.max(0, activePageIndex - 1)] || nextPages[0];
    setPages(nextPages);
    setActivePageId(nextActive.id);
    setSelectedStrokeId(null);
    setIsDirty(true);
  }, [activePageId, activePageIndex, pages]);

  const handlePreparePreview = useCallback(() => {
    setPreviewImages(pages.map((page) => ({ id: page.id, dataUrl: renderPageToDataUrl(page) })));
    setIsPreviewConfirmOpen(true);
  }, [pages]);

  const handleConfirmPreview = useCallback(async () => {
    if (previewImages.length === 0) {
      return;
    }

    setIsExporting(true);
    try {
      const uploadedImages: ReferenceImage[] = [];
      for (let index = 0; index < previewImages.length; index += 1) {
        const preview = previewImages[index];
        const file = dataUrlToFile(preview.dataUrl, `canvas-page-${String(index + 1).padStart(2, '0')}.png`);
        const uploaded = await uploadReferenceImage(file);
        uploadedImages.push({ url: uploaded.url, detail: 'low' });
      }
      onComplete(uploadedImages);
      setIsPreviewConfirmOpen(false);
      onClose();
    } finally {
      setIsExporting(false);
    }
  }, [onClose, onComplete, previewImages]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[140] overflow-hidden bg-bg-primary animate-classic-entrance">
      <div className="absolute inset-0 bg-bg-primary/95" />
      <div className="absolute inset-0 canvas-transition-grid opacity-60" />

      <div className="relative flex h-full w-full">
        <div className="pointer-events-none absolute left-6 top-1/2 z-10 -translate-y-1/2">
          <CanvasToolbar
            tool={tool}
            isToolbarCollapsed={isToolbarCollapsed}
            isBrushSettingsOpen={isBrushSettingsOpen}
            color={color}
            strokeWidth={strokeWidth}
            onToggleCollapse={() => setIsToolbarCollapsed((prev) => !prev)}
            onSelectTool={setTool}
            onToggleBrushSettings={() => setIsBrushSettingsOpen((prev) => !prev)}
            onDeletePage={handleDeletePage}
            onAddPage={handleAddPage}
            onChangeColor={setColor}
            onChangeStrokeWidth={setStrokeWidth}
            t={t}
          />
        </div>

        <div className="pointer-events-none absolute left-6 top-6 z-10">
          <button
            type="button"
            onClick={() => (isDirty ? setIsDiscardConfirmOpen(true) : onClose())}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-xl border border-border/5 bg-bg-secondary/82 px-4 py-3 text-sm text-text-secondary shadow-lg backdrop-blur-md transition-all hover:text-text-primary hover:bg-bg-secondary"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('canvas.back')}
          </button>
        </div>

        <div className="pointer-events-none absolute right-6 top-6 z-10">
          <button
            type="button"
            onClick={handlePreparePreview}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-xl bg-text-primary px-5 py-3 text-sm text-bg-primary shadow-lg transition-all hover:opacity-92"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {t('canvas.confirm')}
          </button>
        </div>

        <div className="flex h-full w-full items-center justify-center px-20 pb-56 pt-20">
          <div className="relative h-full w-full max-w-[1460px] border border-border/5 bg-[#fffefb] shadow-[0_28px_100px_rgba(0,0,0,0.08)]">
            <div className="pointer-events-none absolute inset-0 canvas-paper-grid" />
            <canvas
              ref={canvasRef}
              width={CANVAS_EXPORT_WIDTH}
              height={CANVAS_EXPORT_HEIGHT}
              className="relative z-[1] h-full w-full touch-none"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            />
          </div>
        </div>

        <CanvasPreviewStrip
          pages={pages}
          activePageId={activePageId}
          activePageIndex={activePageIndex}
          selectedStrokeId={selectedStrokeId}
          onSelectPage={(pageId) => {
            setActivePageId(pageId);
            setSelectedStrokeId(null);
          }}
          onAddPage={handleAddPage}
          t={t}
        />
      </div>

      {isDiscardConfirmOpen && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/35 backdrop-blur-sm" onClick={() => setIsDiscardConfirmOpen(false)} />
          <div className="relative w-full max-w-sm rounded-[2rem] border border-border/5 bg-bg-secondary p-6 shadow-2xl">
            <h3 className="text-lg font-medium text-text-primary">{t('canvas.discardTitle')}</h3>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary/80">{t('canvas.discardDescription')}</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsDiscardConfirmOpen(false)}
                className="rounded-2xl bg-bg-primary/55 px-4 py-3 text-sm text-text-secondary transition-all hover:text-text-primary"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsDiscardConfirmOpen(false);
                  onClose();
                }}
                className="rounded-2xl bg-text-primary px-4 py-3 text-sm text-bg-primary transition-all hover:opacity-90"
              >
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {isPreviewConfirmOpen && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/35 backdrop-blur-sm" onClick={() => !isExporting && setIsPreviewConfirmOpen(false)} />
          <div className="relative flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2.25rem] border border-border/5 bg-bg-secondary shadow-2xl">
            <div className="border-b border-border/5 px-6 py-5">
              <h3 className="text-lg font-medium text-text-primary">{t('canvas.previewConfirmTitle')}</h3>
              <p className="mt-1 text-sm text-text-secondary/75">{t('canvas.previewConfirmDescription')}</p>
            </div>
            <div className="grid gap-4 overflow-y-auto px-6 py-6 md:grid-cols-2 xl:grid-cols-3">
              {previewImages.map((image, index) => (
                <div key={image.id} className="overflow-hidden rounded-[1.5rem] border border-border/5 bg-bg-primary/50">
                  <img src={image.dataUrl} alt={t('canvas.previewImageAlt', { index: index + 1 })} className="aspect-[16/10] w-full object-cover" />
                  <div className="flex items-center justify-between px-4 py-3 text-sm text-text-secondary">
                    <span>{t('canvas.previewItem', { index: index + 1 })}</span>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-border/5 px-6 py-4">
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsPreviewConfirmOpen(false)}
                  disabled={isExporting}
                  className="rounded-2xl bg-bg-primary/55 px-5 py-3 text-sm text-text-secondary transition-all hover:text-text-primary disabled:opacity-50"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPreview}
                  disabled={isExporting}
                  className="rounded-2xl bg-text-primary px-5 py-3 text-sm text-bg-primary transition-all hover:opacity-90 disabled:opacity-50"
                >
                  {isExporting ? t('canvas.uploading') : t('common.confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
