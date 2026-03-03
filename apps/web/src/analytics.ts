type Payload = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    plausible?: (event: string, options?: { props?: Payload }) => void;
  }
}

export function trackEvent(event: string, payload: Payload = {}): void {
  try {
    // Google Analytics (gtag)
    window.gtag?.('event', event, payload);
    // Plausible custom events
    window.plausible?.(event, { props: payload });

    // Local debug buffer for quick analysis
    const key = 'robocat_analytics_buffer';
    const existing = JSON.parse(localStorage.getItem(key) || '[]') as Array<{
      event: string;
      payload: Payload;
      t: number;
    }>;
    existing.push({ event, payload, t: Date.now() });
    localStorage.setItem(key, JSON.stringify(existing.slice(-200)));
  } catch {
    // Analytics should never break gameplay
  }
}
