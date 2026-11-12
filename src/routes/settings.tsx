import { createFileRoute } from '@tanstack/react-router';
import { Settings } from '@/components/research/Settings';
import { pageHead } from '@/components/research/Shell';
export const Route = createFileRoute('/settings')({head:()=>pageHead('Settings','Manage Zero To Hero capture compatibility, local storage, and transparent AI configuration.'),component:Settings});
