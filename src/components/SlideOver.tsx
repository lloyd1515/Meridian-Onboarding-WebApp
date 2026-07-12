import React, { useEffect, useRef } from 'react';

interface SlideOverProps {
  onClose: () => void;
  ariaLabel: string;
  // Extra classes for the drawer panel itself (width, padding, layout) --
  // callers vary in width/columns, so this isn't baked in.
  className?: string;
  children: React.ReactNode;
}

// Shared slide-over drawer wrapper: dims the page, renders the panel with
// role="dialog"/aria-modal, and runs a minimal focus trap that keeps
// Tab/Shift+Tab cycling within the drawer while it's open, restores focus to
// whatever triggered it once closed, and closes on Escape.
export const SlideOver: React.FC<SlideOverProps> = ({ onClose, ariaLabel, className = '', children }) => {
  const drawerRef = useRef<HTMLDivElement>(null);
  // Callers whose form state lives in the same component that renders the
  // drawer (e.g. ChecklistTemplateEditor) re-render -- and so pass a new
  // `onClose` closure -- on every keystroke. Reading onClose through a ref
  // lets the mount effect below stay keyed on mount/unmount only, instead of
  // re-running (and re-stealing focus to the first field) on every render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusableSelector = 'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])';
    // Filter out elements hidden via responsive classes (e.g. a mobile-only
    // close button) -- offsetParent is null for display:none elements, and
    // focusing a non-rendered element is a silent no-op.
    const getFocusable = (): HTMLElement[] =>
      drawerRef.current
        ? Array.from(drawerRef.current.querySelectorAll<HTMLElement>(focusableSelector)).filter(el => el.offsetParent !== null)
        : [];

    const focusables = getFocusable();
    (focusables[0] ?? drawerRef.current)?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = getFocusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 bg-[#000000]/40 z-50 flex justify-end">
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        className={`bg-white border-l border-border h-full shadow-2xl focus:outline-none ${className}`}
      >
        {children}
      </div>
    </div>
  );
};

export default SlideOver;
