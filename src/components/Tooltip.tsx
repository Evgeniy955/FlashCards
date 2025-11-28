import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({ 
  content, 
  children, 
  position = 'bottom', 
  delay = 300,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTouchRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const gap = 8; // Distance from element

    let top = 0;
    let left = 0;

    // Calculate fixed position based on viewport coordinates
    switch (position) {
        case 'top':
            top = rect.top - gap;
            left = rect.left + rect.width / 2;
            break;
        case 'bottom':
            top = rect.bottom + gap;
            left = rect.left + rect.width / 2;
            break;
        case 'left':
            top = rect.top + rect.height / 2;
            left = rect.left - gap;
            break;
        case 'right':
            top = rect.top + rect.height / 2;
            left = rect.right + gap;
            break;
    }
    setCoords({ top, left });
  };

  const showTooltip = () => {
    // Disable on touch devices
    if (
      (window.matchMedia && window.matchMedia('(hover: none)').matches) ||
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
      isTouchRef.current
    ) {
      return;
    }

    if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);

    // Calculate initial position
    updatePosition();

    timeoutIdRef.current = setTimeout(() => {
      // Recalculate just before showing to ensure accuracy
      updatePosition();
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
    setIsVisible(false);
  };

  const handleTouchStart = () => {
      isTouchRef.current = true;
      hideTooltip();
  };

  const handleClick = () => {
      hideTooltip();
      if (isTouchRef.current && document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
      }
      setTimeout(() => { isTouchRef.current = false; }, 500);
  };

  // Determine transform to center the tooltip relative to the coordinate
  let transform = '';
  switch (position) {
      case 'top': transform = 'translate(-50%, -100%)'; break;
      case 'bottom': transform = 'translate(-50%, 0)'; break;
      case 'left': transform = 'translate(-100%, -50%)'; break;
      case 'right': transform = 'translate(0, -50%)'; break;
  }

  // Use Portal to render outside of parent stacking contexts
  const tooltipElement = isVisible ? (
    <div 
        style={{ 
            position: 'fixed', 
            top: coords.top, 
            left: coords.left, 
            transform: transform,
            zIndex: 9999 
        }}
        className="pointer-events-none px-2 py-1 text-xs font-medium text-white bg-slate-800 dark:bg-slate-700 rounded shadow-lg whitespace-nowrap border border-slate-600 animate-fade-in"
    >
        {content}
    </div>
  ) : null;

  return (
    <>
        <div 
        ref={containerRef}
        className={`relative flex items-center justify-center ${className}`}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        onTouchStart={handleTouchStart}
        onClick={handleClick}
        >
        {children}
        </div>
        {isVisible && createPortal(tooltipElement, document.body)}
    </>
  );
};
