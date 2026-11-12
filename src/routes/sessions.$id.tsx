import { createFileRoute } from '@tanstack/react-router';
import { SessionReview } from '@/components/research/SessionReview';
import { pageHead } from '@/components/research/Shell';
export const Route = createFileRoute('/sessions/$id')({head:()=>pageHead('Session review','Review real recordings, synchronized events, and human-verified usability evidence.'),component:Review});
function Review() { const {id}=Route.useParams(); return <SessionReview id={id}/>; }
