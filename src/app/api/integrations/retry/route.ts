import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { retryFailedDeliveries } from '@/lib/integrations/dispatcher';

export async function POST() {
  try {
    await requireRole(['admin']);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const retried = await retryFailedDeliveries(20);
  return NextResponse.json({ retried });
}
