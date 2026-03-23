import { COLOR_PRESETS } from './constants';
import type { ToolMode } from './types';

interface CanvasToolbarProps {
  tool: ToolMode;
  isToolbarCollapsed: boolean;
  isBrushSettingsOpen: boolean;
  color: string;
  strokeWidth: number;
  onToggleCollapse: () => void;
  onSelectTool: (tool: ToolMode) => void;
  onToggleBrushSettings: () => void;
  onDeletePage: () => void;
  onAddPage: () => void;
  onChangeColor: (value: string) => void;
  onChangeStrokeWidth: (value: number) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function CanvasToolbar(props: CanvasToolbarProps) {
  const {
    tool,
    isToolbarCollapsed,
    isBrushSettingsOpen,
    color,
    strokeWidth,
    onToggleCollapse,
    onSelectTool,
    onToggleBrushSettings,
    onDeletePage,
    onAddPage,
    onChangeColor,
    onChangeStrokeWidth,
    t,
  } = props;

  const renderToolButton = (mode: ToolMode, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      onClick={() => onSelectTool(mode)}
      className={`flex h-12 ${isToolbarCollapsed ? 'w-12' : 'w-16'} items-center justify-center rounded-xl border transition-all ${
        tool === mode
          ? 'border-text-primary/15 bg-text-primary text-bg-primary shadow-lg'
          : 'border-border/5 bg-bg-secondary/85 text-text-secondary hover:text-text-primary hover:bg-bg-secondary'
      }`}
      title={label}
      aria-label={label}
    >
      <div className="flex flex-col items-center gap-1">
        {icon}
        {!isToolbarCollapsed && <span className="text-[9px] font-medium uppercase tracking-[0.14em]">{label}</span>}
      </div>
    </button>
  );

  return (
    <div className="relative pointer-events-auto">
      <div className={`flex flex-col gap-2 rounded-2xl border border-border/5 bg-bg-secondary/76 p-2 shadow-2xl backdrop-blur-md transition-all ${isToolbarCollapsed ? 'w-16' : 'w-[88px]'}`}>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex h-10 w-full items-center justify-center rounded-xl border border-border/5 bg-bg-primary/50 text-text-secondary transition-all hover:text-text-primary hover:bg-bg-primary/70"
          title={isToolbarCollapsed ? t('canvas.toolbarExpand') : t('canvas.toolbarCollapse')}
        >
          <svg className={`h-4 w-4 transition-transform ${isToolbarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {renderToolButton('select', t('canvas.tool.select'), (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l12 7-5 2 2 5-2 1-2-5-5 2V3z" />
          </svg>
        ))}
        {renderToolButton('pen', t('canvas.tool.pen'), (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
          </svg>
        ))}
        {renderToolButton('eraser', t('canvas.tool.eraser'), (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14a5 5 0 11-10 0 5 5 0 0110 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14H9" />
          </svg>
        ))}

        <button
          type="button"
          onClick={onToggleBrushSettings}
          className={`flex h-12 ${isToolbarCollapsed ? 'w-12' : 'w-16'} items-center justify-center rounded-xl border transition-all ${
            isBrushSettingsOpen
              ? 'border-text-primary/15 bg-text-primary text-bg-primary shadow-lg'
              : 'border-border/5 bg-bg-secondary/85 text-text-secondary hover:text-text-primary hover:bg-bg-secondary'
          }`}
          title={t('canvas.tool.brushSettings')}
        >
          <div className="flex flex-col items-center gap-1">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M7 12h10M10 17h4" />
            </svg>
            {!isToolbarCollapsed && <span className="text-[9px] font-medium uppercase tracking-[0.12em]">{t('canvas.tool.brushSettings')}</span>}
          </div>
        </button>

        <div className="h-px bg-border/10" />

        <button
          type="button"
          onClick={onDeletePage}
          className={`flex h-12 ${isToolbarCollapsed ? 'w-12' : 'w-16'} items-center justify-center rounded-xl border border-border/5 bg-bg-secondary/85 text-red-500 transition-all hover:bg-bg-secondary`}
          title={t('canvas.tool.deletePage')}
        >
          <div className="flex flex-col items-center gap-1">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 7h12M9 7V5h6v2m-7 4v6m4-6v6m4-6v6M7 7l1 12h8l1-12" />
            </svg>
            {!isToolbarCollapsed && <span className="text-[9px] font-medium uppercase tracking-[0.12em]">{t('canvas.tool.deletePage')}</span>}
          </div>
        </button>

        <button
          type="button"
          onClick={onAddPage}
          className={`flex h-12 ${isToolbarCollapsed ? 'w-12' : 'w-16'} items-center justify-center rounded-xl border border-border/5 bg-bg-secondary/85 text-text-secondary transition-all hover:bg-bg-secondary hover:text-text-primary`}
          title={t('canvas.tool.addPage')}
        >
          <div className="flex flex-col items-center gap-1">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m-7-7h14" />
            </svg>
            {!isToolbarCollapsed && <span className="text-[9px] font-medium uppercase tracking-[0.12em]">{t('canvas.tool.addPage')}</span>}
          </div>
        </button>
      </div>

      {tool === 'pen' && isBrushSettingsOpen && (
        <div className="absolute left-0 top-[calc(100%+12px)] w-[112px] rounded-2xl border border-border/5 bg-bg-secondary/80 p-2 shadow-2xl backdrop-blur-md">
          <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-text-secondary/60">{t('canvas.color')}</div>
          <div className="grid grid-cols-2 gap-2">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => onChangeColor(preset)}
                className={`h-7 w-7 rounded-full border-2 transition-all ${color === preset ? 'border-accent scale-95' : 'border-white/70'}`}
                style={{ backgroundColor: preset }}
                aria-label={preset}
              />
            ))}
          </div>
          <input
            type="color"
            value={color}
            onChange={(event) => onChangeColor(event.target.value)}
            className="mt-3 h-8 w-full cursor-pointer rounded-lg border border-border/5 bg-transparent"
          />
          <div className="mt-4 mb-2 text-[10px] uppercase tracking-[0.18em] text-text-secondary/60">{t('canvas.stroke')}</div>
          <input
            type="range"
            min={2}
            max={28}
            value={strokeWidth}
            onChange={(event) => onChangeStrokeWidth(Number(event.target.value))}
            className="w-full accent-text-primary"
          />
          <div className="mt-2 flex items-center justify-between text-[11px] text-text-secondary/70">
            <span>{t('canvas.strokeThin')}</span>
            <span>{strokeWidth}px</span>
            <span>{t('canvas.strokeThick')}</span>
          </div>
        </div>
      )}
    </div>
  );
}
