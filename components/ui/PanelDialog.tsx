import React from 'react';
import useDialog from './useDialog';

export default function PanelDialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useDialog(true, onClose);
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
    <div ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className="studio-dialog floating-panel flex flex-col overflow-hidden rounded-lg border w-full max-w-lg" onClick={event => event.stopPropagation()}>
      <div className="panel-heading flex items-center justify-between shrink-0"><strong>{title}</strong><button className="pp-icon-btn" aria-label={`Close ${title}`} onClick={onClose}>×</button></div>
      <div className="flex flex-1 flex-col min-h-0 overflow-auto">{children}</div>
    </div>
  </div>;
}
