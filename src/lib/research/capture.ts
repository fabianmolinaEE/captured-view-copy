import { EventLogger } from './eventLogger';
import { scenarios, type Category, type Session } from './types';
export type CaptureState = 'idle' | 'requesting_permission' | 'recording' | 'stopping' | 'saved' | 'error';
export function captureSupport() { return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia && typeof MediaRecorder !== 'undefined'; }
export class CaptureController {
  logger = new EventLogger();
  private recorder?: MediaRecorder;
  private stream?: MediaStream;
  private chunks: Blob[] = [];
  private stopping = false;
  private anchor = 0;
  private pending?: Session;
  private completed?: (s: Session) => void;
  constructor(private state: (state: CaptureState, error?: string) => void) {}
  async start(title: string, config: Category[], delay: number, onComplete: (s: Session) => void) {
    if (!captureSupport()) { this.state('error', 'Tab recording is unavailable here. Open this app in desktop Chrome or Edge over HTTPS.'); return; }
    this.state('requesting_permission');
    try {
      this.stream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'browser' }, audio: false });
      const track = this.stream.getVideoTracks()[0];
      if (!track) throw new Error('No screen video was selected.');
      if (track.getSettings().displaySurface && track.getSettings().displaySurface !== 'browser') throw new Error('Please select a browser tab rather than a screen or window, then choose the Test App tab.');
      const mime = ['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm','video/mp4'].find(m => MediaRecorder.isTypeSupported(m));
      this.recorder = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
      this.chunks = []; this.stopping = false; this.completed = onComplete;
      const now = new Date().toISOString(); const id = crypto.randomUUID();
      this.pending = { id, title: title.trim() || 'Checkout research session', created_at: now, captured_at: now, duration_ms: 0, video_blob: new Blob(), mime_type: this.recorder.mimeType, extension: this.recorder.mimeType.includes('mp4') ? 'mp4' : 'webm', capture_mode:'browser_tab', source_app:'Carry checkout', scenario_config:[...config], loading_delay_ms: delay, status:'captured', consent_confirmed:true, event_count:0, events:[], findings:[], issues: scenarios.filter(s => config.includes(s.id)).map(s => ({ id: crypto.randomUUID(), category: s.id, screen:s.screen, actually_observed:'unknown' })), matches:[], runs:[], video_start_offset_ms:0 };
      this.recorder.ondataavailable = e => { if (e.data.size) this.chunks.push(e.data); };
      this.recorder.onstop = () => this.finalize();
      this.recorder.onerror = () => { this.state('error', 'Recording was interrupted. Any captured video will still be saved.'); this.stop(); };
      track.onended = () => this.stop();
      this.recorder.onstart = () => { this.anchor = performance.now(); this.logger.start(id, this.anchor); this.state('recording'); };
      this.recorder.start(500);
    } catch (error) { this.stream?.getTracks().forEach(t => t.stop()); this.state('error', error instanceof DOMException && error.name === 'NotAllowedError' ? 'Screen sharing was canceled or denied. Nothing was recorded. Try again and select this tab.' : error instanceof Error ? error.message : 'Screen recording could not start.'); }
  }
  elapsed() { return this.anchor ? Math.round(performance.now() - this.anchor) : 0; }
  stop() {
    if (this.stopping || !this.recorder || this.recorder.state === 'inactive') return;
    this.stopping = true;
    if (this.pending) { this.pending.duration_ms = this.elapsed(); this.pending.events = this.logger.stop(); }
    this.state('stopping'); this.recorder.stop();
  }
  private finalize() {
    this.stream?.getTracks().forEach(t => t.stop());
    if (!this.pending || !this.chunks.length) { this.state('error','No video data was captured. Start again and keep the session open for a few seconds.'); return; }
    this.pending.video_blob = new Blob(this.chunks, { type:this.pending.mime_type });
    this.pending.event_count = this.pending.events.length;
    this.state('saved'); this.completed?.(this.pending);
  }
}
