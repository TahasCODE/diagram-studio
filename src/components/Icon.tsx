export type IconName = 'diagram' | 'play' | 'edit' | 'folder' | 'file' | 'sun' | 'moon' | 'save' | 'share' | 'undo' | 'redo' | 'left' | 'right' | 'restart' | 'plus' | 'trash' | 'copy' | 'upload' | 'download' | 'arrange' | 'branch' | 'check' | 'close' | 'logout' | 'user' | 'external' | 'history' | 'chevron';
import type { ReactNode } from 'react';
const paths: Record<IconName, ReactNode> = {
  diagram: <><rect x="3" y="3" width="6" height="6" rx="1.4"/><rect x="15" y="15" width="6" height="6" rx="1.4"/><path d="M6 9v9h9M9 6h9v9"/></>,
  play: <path d="m9 5 11 7-11 7V5Z"/>,
  edit: <><path d="m15 5 4 4M4 20l5-1L21 7a2.8 2.8 0 0 0-4-4L5 15l-1 5Z"/></>,
  folder: <path d="M3 7V5h6l3 3h9v11H3V7Z"/>,
  file: <><path d="M14 3H5v18h14V8l-5-5Z"/><path d="M14 3v6h5M8 13h8M8 17h5"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></>,
  moon: <path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z"/>,
  save: <><path d="M4 3h13l4 4v14H3V3h1Z"/><path d="M7 3v6h9V3M7 21v-8h10v8"/></>,
  share: <><path d="M12 16V3m-5 5 5-5 5 5M5 12v8h14v-8"/></>,
  undo: <><path d="m9 4-5 5 5 5M4 9h10a6 6 0 0 1 0 12"/></>,
  redo: <><path d="m15 4 5 5-5 5m5-5H10a6 6 0 0 0 0 12"/></>,
  left: <path d="m12 5-7 7 7 7m-7-7h15"/>,
  right: <path d="m12 5 7 7-7 7M4 12h15"/>,
  restart: <><path d="M4 10a8 8 0 1 1 1 7M4 4v6h6"/></>,
  plus: <path d="M12 4v16M4 12h16"/>,
  trash: <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></>,
  copy: <><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/></>,
  upload: <path d="M12 16V3m-5 5 5-5 5 5M4 17v4h16v-4"/>,
  download: <path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>,
  arrange: <><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/></>,
  branch: <><circle cx="6" cy="5" r="2"/><circle cx="18" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><path d="M6 7v10m0-5h5a7 7 0 0 0 7-5"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  close: <path d="m6 6 12 12M6 18 18 6"/>,
  logout: <><path d="M9 3H3v18h6m6-15 6 6-6 6M8 12h13"/></>,
  user: <><circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>,
  external: <path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7"/>,
  history: <><path d="M4 10a8 8 0 1 1 1 7M4 4v6h6m2-3v6l4 2"/></>,
  chevron: <path d="m9 5 7 7-7 7"/>,
};
export function Icon({name, size=18}: {name: IconName; size?: number}) {
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
