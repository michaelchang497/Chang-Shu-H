import { useEffect, useRef, useState } from 'react';

interface Props {
  patientName: string;
  patientId: string; // 目前載入的病歷號
  inputValue: string;
  onInputChange: (v: string) => void;
  /** 回傳 true 表示查詢成功（成功後自動收合） */
  onSearch: () => boolean;
  error: string;
}

const POS_KEY = 'csh-search-fab-pos';
const CHIP_W = 250;
const CHIP_H = 64;

function clamp(p: { x: number; y: number }) {
  return {
    x: Math.min(Math.max(8, p.x), Math.max(8, window.innerWidth - CHIP_W - 8)),
    y: Math.min(Math.max(8, p.y), Math.max(8, window.innerHeight - CHIP_H - 8)),
  };
}

function initialPos() {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (raw) return clamp(JSON.parse(raw));
  } catch {
    /* 沒有儲存的位置就用預設 */
  }
  return clamp({ x: window.innerWidth - CHIP_W - 24, y: window.innerHeight - CHIP_H - 120 });
}

// 查詢完成後，搜尋改成可拖曳的懸浮元件：點一下展開輸入新的病歷號，拖曳可移動位置。
export default function FloatingSearch({ patientName, patientId, inputValue, onInputChange, onSearch, error }: Props) {
  const [pos, setPos] = useState(initialPos);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onResize = () => setPos((p) => clamp(p));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.select();
  }, [open]);

  function down(e: React.PointerEvent<HTMLButtonElement>) {
    drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < 6) return; // 小幅晃動視為點擊
    if (!d.moved) {
      d.moved = true;
      setDragging(true);
    }
    setPos(clamp({ x: d.ox + dx, y: d.oy + dy }));
  }
  function up() {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved) {
      setDragging(false);
      try {
        localStorage.setItem(POS_KEY, JSON.stringify(pos));
      } catch {
        /* 不影響使用 */
      }
    } else {
      setOpen((o) => !o);
    }
  }

  function submit() {
    if (onSearch()) setOpen(false);
  }

  const alignRight = pos.x > window.innerWidth / 2;
  const above = pos.y > window.innerHeight / 2;

  return (
    <div className={`fab-search${dragging ? ' dragging' : ''}`} style={{ left: pos.x, top: pos.y }}>
      <button
        type="button"
        className="fab-chip"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        aria-expanded={open}
        aria-label="切換病患：點擊展開，拖曳可移動位置"
      >
        <svg viewBox="0 0 24 24" className="btn-ic"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        <span className="fab-chip-text">
          <b>{patientName}</b>
          <small>{patientId}</small>
        </span>
        <svg viewBox="0 0 24 24" className="fab-grip" aria-hidden="true">
          <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
          <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
          <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
        </svg>
      </button>
      {open && (
        <div className={`fab-panel${alignRight ? ' right' : ''}${above ? ' above' : ''}`}>
          <div className="fab-panel-head">
            <b>查詢其他病患</b>
            <button type="button" className="fab-close" onClick={() => setOpen(false)} aria-label="關閉">✕</button>
          </div>
          <div className="search-row">
            <input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="輸入病歷號碼"
              inputMode="numeric"
            />
            <button type="button" onClick={submit}>查詢病患</button>
          </div>
          <p className="hint">可測試病歷號：10010881（林彰美）、10010882（陳彰秀）、10010883（王彰和）。</p>
          {error && <p className="error">{error}</p>}
        </div>
      )}
    </div>
  );
}
