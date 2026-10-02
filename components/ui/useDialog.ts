import { useEffect, useRef } from 'react';

/** Keep keyboard focus inside an open dialog and restore it on close. */
export default function useDialog(isOpen: boolean, onClose: () => void, canClose = true) {
    const dialogRef = useRef<HTMLDivElement>(null);
    const closeRef = useRef(onClose);
    const canCloseRef = useRef(canClose);
    closeRef.current = onClose;
    canCloseRef.current = canClose;

    useEffect(() => {
        if (!isOpen) return;
        const previousFocus = document.activeElement as HTMLElement | null;
        const focusable = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]'
        ) || []).filter(element => element.getClientRects().length > 0);
        (focusable()[0] || dialogRef.current)?.focus();
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                if (canCloseRef.current) closeRef.current();
            }
            if (event.key === 'Tab') {
                const items = focusable();
                const first = items[0];
                const last = items[items.length - 1];
                if (!first) { event.preventDefault(); dialogRef.current?.focus(); return; }
                if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
                    event.preventDefault(); last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault(); first.focus();
                }
            }
        };
        document.addEventListener('keydown', handleKeyDown, true);
        return () => {
            document.removeEventListener('keydown', handleKeyDown, true);
            if (previousFocus?.isConnected) previousFocus.focus();
        };
    }, [isOpen]);
    return dialogRef;
}
