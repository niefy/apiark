import { useEffect, useState, useCallback, useRef } from "react";
import type { SseEvent, SseStatus, KeyValuePair } from "@apiark/types";
import { sseConnect, sseDisconnect, sseIsConnected } from "@/lib/tauri-api";

/** Module-level cache: events and status persist across component unmount/remount */
const eventCache = new Map<string, SseEvent[]>();
const statusCache = new Map<string, "disconnected" | "connecting" | "connected">();

interface UseSSEReturn {
  status: "disconnected" | "connecting" | "connected";
  events: SseEvent[];
  error: string | null;
  connect: (url: string, headers: KeyValuePair[]) => Promise<void>;
  disconnect: () => Promise<void>;
  clearEvents: () => void;
}

export function useSSE(connectionId: string): UseSSEReturn {
  // Initialize from cache so events survive unmount/remount
  const [status, setStatus] = useState<"disconnected" | "connecting" | "connected">(
    () => statusCache.get(connectionId) ?? "disconnected",
  );
  const [events, setEvents] = useState<SseEvent[]>(
    () => eventCache.get(connectionId) ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const unlistenersRef = useRef<(() => void)[]>([]);

  // On mount: check if the Rust-side connection is still alive
  useEffect(() => {
    let cancelled = false;
    sseIsConnected(connectionId).then((connected) => {
      if (cancelled) return;
      if (connected && statusCache.get(connectionId) !== "connected") {
        setStatus("connected");
        statusCache.set(connectionId, "connected");
      }
    }).catch(() => { /* ignore — not in Tauri env */ });
    return () => { cancelled = true; };
  }, [connectionId]);

  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");

        const unlistenStatus = await listen<SseStatus>("sse:status", (event) => {
          if (cancelled || event.payload.connectionId !== connectionId) return;
          const newStatus = event.payload.state as "disconnected" | "connecting" | "connected";
          setStatus(newStatus);
          statusCache.set(connectionId, newStatus);
          setError(event.payload.error ?? null);
        });

        const unlistenEvent = await listen<SseEvent>("sse:event", (event) => {
          if (cancelled || event.payload.connectionId !== connectionId) return;
          setEvents((prev) => {
            const updated = [...prev, event.payload];
            eventCache.set(connectionId, updated);
            return updated;
          });
        });

        unlistenersRef.current = [unlistenStatus, unlistenEvent];
      } catch {
        // Not in Tauri env
      }
    };

    setup();

    return () => {
      cancelled = true;
      for (const unlisten of unlistenersRef.current) {
        unlisten();
      }
      unlistenersRef.current = [];
    };
  }, [connectionId]);

  const connect = useCallback(
    async (url: string, headers: KeyValuePair[]) => {
      setError(null);
      try {
        await sseConnect(connectionId, { url, headers });
      } catch (err) {
        setError(String(err));
        setStatus("disconnected");
        statusCache.set(connectionId, "disconnected");
      }
    },
    [connectionId],
  );

  const disconnect = useCallback(async () => {
    try {
      await sseDisconnect(connectionId);
      // Clear cache for this connection on explicit disconnect
      eventCache.delete(connectionId);
      statusCache.delete(connectionId);
    } catch (err) {
      setError(String(err));
    }
  }, [connectionId]);

  const clearEvents = useCallback(() => {
    setEvents([]);
    eventCache.delete(connectionId);
  }, [connectionId]);

  return { status, events, error, connect, disconnect, clearEvents };
}
