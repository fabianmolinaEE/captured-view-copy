import type { SessionEvent } from './types';
export class EventLogger {
  events: SessionEvent[] = [];
  private active = false;
  private anchor = 0;
  private sessionId = '';
  start(sessionId: string, anchor: number) { this.events = []; this.sessionId = sessionId; this.anchor = anchor; this.active = true; }
  stop() { this.active = false; return [...this.events].sort((a,b) => a.t_ms - b.t_ms); }
  log(type: string, screen: string, details: Omit<Partial<SessionEvent>, 'id' | 'session_id' | 't_ms' | 'type' | 'screen'> = {}) {
    if (!this.active) return;
    // Callers supply semantic metadata only; form values never enter the logger.
    this.events.push({ id: crypto.randomUUID(), session_id: this.sessionId, t_ms: Math.max(0, Math.round(performance.now() - this.anchor)), type, screen, ...details });
  }
}
