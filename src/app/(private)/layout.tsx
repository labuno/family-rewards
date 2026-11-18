import { redirect } from 'next/navigation';
import { requireUser } from '../../server/session';
import { database } from '../../server/db';
import { Shell } from '../../components/shell';
export const dynamic = 'force-dynamic';
export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (!(await database().setting.findUnique({ where: { id: 1 } }))) redirect('/setup');
  return <Shell user={user}>{children}</Shell>;
}
