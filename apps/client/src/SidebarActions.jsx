import { createContext, useContext } from 'react';
import { createPortal } from 'react-dom';

export const SidebarTarget = createContext(null);
// Keep local selection state in each view while mounting its actions below the
// shared city activity panel. No second transport or duplicated game state.
export function SidebarActions({ children }) {
  const target = useContext(SidebarTarget);
  return target ? createPortal(children, target) : null;
}
