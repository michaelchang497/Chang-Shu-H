import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  label: string;
  /** 已確認的簽名圖（data URL），由上層保存 */
  value: string | null;
  onChange: (dataUrl: string | null) => void;
}

// 簽名卡：點擊後跳出簽名視窗，按「確定」才把簽名圖帶回卡片。
export default function SignaturePad({ label, value, onChange }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="signature-pad">
      <div className="signature-pad-header">
        <span className="signature-pad-label">{label}</span>
        <button type="button" className="link-btn" onClick={() => onChange(null)} disabled={!value}>
          重置簽名
        </button>
      </div>
      <button type="button" className="signature-box" onClick={() => setOpen(true)} aria-label={`${label}：點擊簽名`}>
        {value ? (
          <img src={value} alt={`${label}已簽名`} />
        ) : (
          <span className="signature-hint">點擊此處簽名</span>
        )}
      </button>
      {open && (
        <SignatureDialog
          title={label}
          onCancel={() => setOpen(false)}
          onConfirm={(url) => {
            onChange(url);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function SignatureDialog({
  title,
  onCancel,
  onConfirm,
}: {
  title: string;
  onCancel: () => void;
  onConfirm: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * canvas.width) / rect.width,
      y: ((e.clientY - rect.top) * canvas.height) / rect.height,
    };
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    drawing.current = true;
    canvas.setPointerCapture(e.pointerId);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = getPos(e);
    ctx.strokeStyle = '#14532d';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasInk(true);
  }

  function up() {
    drawing.current = false;
  }

  function clear() {
    const canvas = canvasRef.current!;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  }

  return createPortal(
    <div className="sig-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="sig-dialog">
        <div className="sig-dialog-title">{title}</div>
        <div className="sig-dialog-canvas">
          <canvas
            ref={canvasRef}
            width={1000}
            height={400}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
          />
          {!hasInk && <div className="signature-hint">請在框內簽名</div>}
        </div>
        <div className="sig-dialog-actions">
          <button type="button" className="big-btn ghost" onClick={clear} disabled={!hasInk}>
            清除重寫
          </button>
          <span className="sig-dialog-spacer" />
          <button type="button" className="big-btn ghost" onClick={onCancel}>
            取消
          </button>
          <button
            type="button"
            className="big-btn primary"
            disabled={!hasInk}
            onClick={() => onConfirm(canvasRef.current!.toDataURL('image/png'))}
          >
            確定
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
