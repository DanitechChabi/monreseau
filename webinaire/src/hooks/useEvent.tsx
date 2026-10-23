import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { event as baseEvent, type EventConfig, withSettings } from "../config/event";
import { fetchPublicSettings } from "../lib/backend";

const EventContext = createContext<EventConfig>(baseEvent);

/** Fournit la configuration statique, complétée par les réglages publiés depuis /admin. */
export function EventProvider({ children }: { children: ReactNode }) {
  const [cfg, setCfg] = useState<EventConfig>(baseEvent);
  useEffect(() => {
    let alive = true;
    void fetchPublicSettings(baseEvent.id).then((s) => {
      if (alive && s) setCfg(withSettings(baseEvent, s));
    });
    return () => {
      alive = false;
    };
  }, []);
  return <EventContext.Provider value={cfg}>{children}</EventContext.Provider>;
}

export const useEvent = () => useContext(EventContext);
