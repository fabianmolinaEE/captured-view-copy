import { z } from 'zod';
import { categories, type Session, type Finding } from './types';
import type { Frame } from './frameSampler';
const output = z.object({ findings: z.array(z.object({ category:z.enum(categories), title:z.string().min(1), description:z.string(), timestamp_ms:z.number().finite(), end_timestamp_ms:z.number().finite().optional(), screen:z.string().optional(), confidence:z.number().min(0).max(1), visual_evidence:z.string(), event_ids:z.array(z.string()), why_video_matters:z.string(), evidence_sources:z.array(z.enum(['video','events'])) })).max(50) });
export function validateFindings(raw: unknown, session: Session, runId: string): Finding[] {
  return output.parse(raw).findings.map(f => ({ ...f, id: crypto.randomUUID(), session_id:session.id, analysis_run_id:runId, timestamp_ms:Math.min(session.duration_ms,Math.max(0,f.timestamp_ms)), end_timestamp_ms:f.end_timestamp_ms === undefined ? undefined : Math.min(session.duration_ms,Math.max(f.timestamp_ms, f.end_timestamp_ms, 0)), event_ids:f.event_ids.filter(id => session.events.some(e => e.id === id)), review_status:'pending' }));
}
// Intentionally enumerate the payload: the answer key and review decisions never cross this boundary.
export function blindPayload(session: Session, frames: Frame[]) {
  return { duration_ms: session.duration_ms, frames, events: session.events.map(({ id,t_ms,type,screen,target_id,x,y,operation_id,metadata }) => ({ id,t_ms,type,screen,target_id,x,y,operation_id,metadata })), categories:[...categories], mode:'video_frames_plus_events' as const };
}
export const aiStatus = { configured: false, message:'AI is not configured. Recording, playback, and local review are available. A secure Gemini connection must be added before sampled frames can be analyzed.' };
