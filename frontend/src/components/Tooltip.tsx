import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  text: string;
  children: React.ReactNode;
  /** Where the tooltip appears relative to the trigger. Default: 'top' */
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * Tooltip — A portal-based custom tooltip that renders at position:fixed
 * so it NEVER gets clipped by parent overflow:auto / overflow:hidden containers.
 *
 * Usage:
 *   <Tooltip text="Delete Account">
 *     <button>...</button>
 *   </Tooltip>
 */
export default function Tooltip({ text, children, placement = 'top' }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  const show = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    let x = 0;
    let y = 0;

    switch (placement) {
      case 'top':
        x = rect.left + rect.width / 2;
        y = rect.top - 8;
        break;
      case 'bottom':
        x = rect.left + rect.width / 2;
        y = rect.bottom + 8;
        break;
      case 'left':
        x = rect.left - 8;
        y = rect.top + rect.height / 2;
        break;
      case 'right':
        x = rect.right + 8;
        y = rect.top + rect.height / 2;
        break;
    }
    setCoords({ x, y });
    setVisible(true);
  }, [placement]);

  const hide = useCallback(() => setVisible(false), []);

  /** Tooltip anchor style based on placement */
  const getTooltipStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'fixed',
      zIndex: 99999,
      backgroundColor: 'rgba(15, 15, 25, 0.95)',
      color: '#f3f4f6',
      fontSize: '11px',
      fontWeight: 600,
      padding: '5px 10px',
      borderRadius: '6px',
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
      border: '1px solid rgba(255,255,255,0.12)',
      boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
      backdropFilter: 'blur(8px)',
      letterSpacing: '0.3px',
      transition: 'opacity 0.15s ease',
      opacity: visible ? 1 : 0,
    };

    switch (placement) {
      case 'top':
        return { ...base, left: coords.x, top: coords.y, transform: 'translate(-50%, -100%)' };
      case 'bottom':
        return { ...base, left: coords.x, top: coords.y, transform: 'translate(-50%, 0)' };
      case 'left':
        return { ...base, left: coords.x, top: coords.y, transform: 'translate(-100%, -50%)' };
      case 'right':
        return { ...base, left: coords.x, top: coords.y, transform: 'translate(0, -50%)' };
    }
  };

  /** Small triangle arrow */
  const getArrowStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'fixed',
      zIndex: 99998,
      width: 0,
      height: 0,
      pointerEvents: 'none',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.15s ease',
    };

    switch (placement) {
      case 'top':
        return {
          ...base,
          left: coords.x,
          top: coords.y,
          transform: 'translate(-50%, -2px)',
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderTop: '5px solid rgba(15, 15, 25, 0.95)',
        };
      case 'bottom':
        return {
          ...base,
          left: coords.x,
          top: coords.y,
          transform: 'translate(-50%, -100%) translateY(-3px)',
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderBottom: '5px solid rgba(15, 15, 25, 0.95)',
        };
      case 'left':
        return {
          ...base,
          left: coords.x,
          top: coords.y,
          transform: 'translate(-2px, -50%)',
          borderTop: '5px solid transparent',
          borderBottom: '5px solid transparent',
          borderLeft: '5px solid rgba(15, 15, 25, 0.95)',
        };
      case 'right':
        return {
          ...base,
          left: coords.x,
          top: coords.y,
          transform: 'translate(-100%) translateX(-3px) translateY(-50%)',
          borderTop: '5px solid transparent',
          borderBottom: '5px solid transparent',
          borderRight: '5px solid rgba(15, 15, 25, 0.95)',
        };
    }
  };

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        style={{ display: 'inline-flex' }}
      >
        {children}
      </div>

      {visible && createPortal(
        <>
          <div style={getTooltipStyle()}>{text}</div>
          <div style={getArrowStyle()} />
        </>,
        document.body
      )}
    </>
  );
}
