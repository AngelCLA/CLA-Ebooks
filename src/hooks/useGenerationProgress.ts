import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";

interface ProgressState {
  active: boolean;
  percent: number;
  message: string;
}

export function useGenerationProgress() {
  const [state, setState] = useState<ProgressState>({
    active: false,
    percent: 0,
    message: "Preparando el ebook",
  });
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listen<{ percent: number; message: string }>(
      "generation-progress",
      (event) => {
        setState({
          active: event.payload.percent < 100,
          percent: event.payload.percent,
          message: event.payload.message,
        });
        if (event.payload.percent === 100)
          window.setTimeout(
            () => setState((current) => ({ ...current, active: false })),
            350,
          );
      },
    ).then((stop) => {
      unlisten = stop;
    });
    return () => unlisten?.();
  }, []);
  return state;
}
