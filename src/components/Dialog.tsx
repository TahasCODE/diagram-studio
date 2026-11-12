import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Icon } from './Icon';
export function Dialog({title, onClose, children}: {title: string; onClose: () => void; children: ReactNode}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} className="app-dialog" aria-labelledby="dialog-title" onCancel={e => { e.preventDefault(); onClose(); }}>
    <div className="dialog-heading"><h2 id="dialog-title">{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close Dialog"><Icon name="close"/></button></div>{children}
  </dialog>;
}
