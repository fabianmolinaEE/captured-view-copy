import { createFileRoute, redirect } from '@tanstack/react-router';
import { pageHead } from '@/components/research/Shell';
export const Route = createFileRoute('/')({ head: () => pageHead('Sessions', 'Zero To Hero — evidence-first usability research with real browser recordings.'), beforeLoad: () => { throw redirect({ to: '/sessions' }); } });
