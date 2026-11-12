import { createFileRoute } from '@tanstack/react-router';
import { Sessions } from '@/components/research/Sessions';
import { pageHead } from '@/components/research/Shell';
export const Route = createFileRoute('/sessions/')({head:()=>pageHead('Sessions','Find friction that logs can’t explain. Real browser recordings and local evidence.'),component:Sessions});
