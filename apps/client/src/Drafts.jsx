import { createContext, useContext, useEffect, useId } from "react";
export const Drafts = createContext({
  register: () => {},
  leave: (action) => action(),
});
export function useDraft(dirty) {
  const context = useContext(Drafts),
    id = useId();
  useEffect(() => {
    context.register(id, dirty);
    return () => context.register(id, false);
  }, [dirty, id, context.register]);
  return (action) => (dirty ? context.leave(action) : action());
}
