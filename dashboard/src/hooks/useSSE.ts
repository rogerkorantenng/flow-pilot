import { useEffect, useRef, useCallback, useState } from 'react';
import type { SSEEvent } from '../types/workflow';

export function useSSE(runId: string | null, onEvent: (event: SSEEvent) => void) {
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (!runId) return;

    const url = `/api/runs/${runId}/live`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => setConnected(true);

    const handleEvent = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as SSEEvent;
        onEventRef.current(data);
        if (data.type === 'run_completed' || data.type === 'run_failed') {
          es.close();
          setConnected(false);
        }
      } catch {
        // ignore parse errors
      }
    };

    es.addEventListener('run_started', handleEvent);
    es.addEventListener('step_started', handleEvent);
    es.addEventListener('step_completed', handleEvent);
    es.addEventListener('step_failed', handleEvent);
    es.addEventListener('step_skipped', handleEvent);
    es.addEventListener('run_completed', handleEvent);
    es.addEventListener('run_failed', handleEvent);
    es.addEventListener('heartbeat', handleEvent);

    es.onerror = () => {
      setConnected(false);
      es.close();
    };
  }, [runId]);

  useEffect(() => {
    connect();
    return () => {
      eventSourceRef.current?.close();
      setConnected(false);
    };
  }, [connect]);

  const disconnect = useCallback(() => {
    eventSourceRef.current?.close();
    setConnected(false);
  }, []);

  return { connected, disconnect };
}
