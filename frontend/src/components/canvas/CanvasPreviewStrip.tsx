import { renderPageToDataUrl } from './canvas-render';
import type { CanvasPage } from './types';

interface CanvasPreviewStripProps {
  pages: CanvasPage[];
  activePageId: string;
  activePageIndex: number;
  selectedStrokeId: string | null;
  onSelectPage: (pageId: string) => void;
  onAddPage: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function CanvasPreviewStrip({
  pages,
  activePageId,
  activePageIndex,
  selectedStrokeId,
  onSelectPage,
  onAddPage,
  t,
}: CanvasPreviewStripProps) {
  return (
    <div className="pointer-events-none absolute bottom-10 left-1/2 z-10 w-[min(1080px,calc(100vw-160px))] -translate-x-1/2">
      <div className="pointer-events-auto rounded-[18px] border border-border/5 bg-bg-secondary/80 px-4 py-3 shadow-2xl backdrop-blur-md">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-[0.24em] text-text-secondary/60">
            {t('canvas.previewLabel')}
          </div>
          <div className="text-sm text-text-secondary/70">
            {t('canvas.pageStatus', { current: activePageIndex + 1, total: pages.length })}
          </div>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-1">
          {pages.map((page, index) => (
            <button
              key={page.id}
              type="button"
              onClick={() => onSelectPage(page.id)}
              className={`group relative h-24 min-w-[168px] overflow-hidden rounded-[14px] border transition-all ${
                page.id === activePageId
                  ? 'border-accent bg-white shadow-md'
                  : 'border-border/5 bg-bg-primary/55 hover:bg-bg-primary/75'
              }`}
            >
              <img src={renderPageToDataUrl(page, page.id === activePageId ? selectedStrokeId : null)} alt="" className="h-full w-full object-cover" />
              <span className="absolute bottom-2 right-2 bg-bg-secondary/90 px-2 py-1 text-[10px] font-medium text-text-secondary shadow-sm">
                {String(index + 1).padStart(2, '0')}
              </span>
            </button>
          ))}

          <button
            type="button"
            onClick={onAddPage}
            className="flex h-24 min-w-[72px] items-center justify-center rounded-[14px] border border-dashed border-border/10 bg-bg-primary/45 text-2xl text-text-secondary transition-all hover:text-text-primary hover:bg-bg-primary/70"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
