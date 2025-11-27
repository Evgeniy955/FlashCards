import React, { useState } from 'react';

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
    const [timeoutId, setTimeoutId] = useState<ReturnType<typeof setTimeout> | null>(null);

    const showTooltip = () => {
        // Disable tooltips on devices that don't support hover (e.g., touchscreens)
        // to prevent the tooltip from getting stuck open after a tap.
        if (window.matchMedia && window.matchMedia('(hover: none)').matches) {
            return;
        }

        const id = setTimeout(() => {
            setIsVisible(true);
        }, delay);
        setTimeoutId(id);
    };

    const hideTooltip = () => {
        if (timeoutId) {
            clearTimeout(timeoutId);
            setTimeoutId(null);
        }
        setIsVisible(false);
    };

    const positionClasses = {
        top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
        bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
        left: 'right-full top-1/2 -translate-y-1/2 mr-2',
        right: 'left-full top-1/2 -translate-y-1/2 ml-2',
    };

    const arrowClasses = {
        top: 'top-full left-1/2 -translate-x-1/2 border-t-slate-800 dark:border-t-slate-700',
        bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-slate-800 dark:border-b-slate-700',
        left: 'left-full top-1/2 -translate-y-1/2 border-l-slate-800 dark:border-l-slate-700',
        right: 'right-full top-1/2 -translate-y-1/2 border-r-slate-800 dark:border-r-slate-700',
    };

    return (
        <div
            className={`relative flex items-center justify-center ${className}`}
            onMouseEnter={showTooltip}
            onMouseLeave={hideTooltip}
            onFocus={showTooltip}
            onBlur={hideTooltip}
        >
            {children}
            {isVisible && (
                <div className={`absolute z-50 px-2 py-1 text-xs font-medium text-white bg-slate-800 dark:bg-slate-700 rounded shadow-lg whitespace-nowrap pointer-events-none transition-opacity duration-200 opacity-100 ${positionClasses[position]}`}>
                    {content}
                    <div className={`absolute border-4 border-transparent ${arrowClasses[position]}`}></div>
                </div>
            )}
        </div>
    );
};
