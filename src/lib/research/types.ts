export const categories = ['long_loading', 'silent_form_rejection', 'silent_failure', 'fighting_ui', 'missed_button', 'rage_or_hesitation'] as const;
export type Category = typeof categories[number];
export const scenarios: { id: Category; name: string; detail: string; screen: string }[] = [
  { id: 'long_loading', name: 'Long loading', detail: 'A visible loading state delays item details.', screen: 'item_details' },
  { id: 'silent_form_rejection', name: 'Silent form rejection', detail: 'A valid-looking postal code is rejected without feedback.', screen: 'delivery_form' },
  { id: 'silent_failure', name: 'Request timeout', detail: 'The order stalls after a simulated request times out.', screen: 'review_order' },
  { id: 'fighting_ui', name: 'Fighting modal', detail: 'A promotional overlay returns after dismissal.', screen: 'browse' },
  { id: 'missed_button', name: 'Missed button', detail: 'A small checkout target allows near-misses.', screen: 'item_details' },
];
export interface SessionEvent { id: string; session_id: string; t_ms: number; type: string; screen: string; target_id?: string; x?: number; y?: number; operation_id?: string; metadata?: Record<string, string | number | boolean>; }
export interface Finding { id: string; session_id: string; analysis_run_id: string; category: Category; title: string; description: string; timestamp_ms: number; end_timestamp_ms?: number; screen?: string; confidence: number; visual_evidence: string; event_ids: string[]; why_video_matters: string; evidence_sources: ('video' | 'events')[]; review_status: 'pending' | 'accepted' | 'rejected'; reviewer_note?: string; }
export interface GroundTruthIssue { id: string; category: Category; screen: string; actually_observed: 'yes' | 'no' | 'unknown'; notes?: string; }
export interface FindingMatch { finding_id: string; ground_truth_issue_id: string | null; reviewer_verified: boolean; video_necessary: 'yes' | 'no' | 'unknown'; evidence_verified: boolean; }
export interface AnalysisRun { id: string; mode: 'video_frames_plus_events' | 'events_only'; model_name: string; status: 'completed' | 'failed'; frame_count: number; started_at: string; completed_at: string; latency_ms?: number; error?: string; }
export interface Session { id: string; title: string; created_at: string; captured_at: string; duration_ms: number; video_blob: Blob; mime_type: string; extension: string; capture_mode: string; source_app: string; scenario_config: Category[]; loading_delay_ms: number; status: 'captured' | 'analyzed' | 'reviewed'; consent_confirmed: boolean; event_count: number; events: SessionEvent[]; findings: Finding[]; issues: GroundTruthIssue[]; matches: FindingMatch[]; runs: AnalysisRun[]; video_start_offset_ms: number; }
export interface SamplingSettings { interval_seconds: number; max_frames: number; max_width: number; }
export const defaultSampling: SamplingSettings = { interval_seconds: 2, max_frames: 24, max_width: 960 };
export const duration = (ms: number) => `${Math.floor(ms / 60000).toString().padStart(2, '0')}:${Math.floor(ms / 1000 % 60).toString().padStart(2, '0')}`;
export const label = (s: string) => s.replaceAll('_', ' ');
