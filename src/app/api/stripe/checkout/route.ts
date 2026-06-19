import { NextResponse } from 'next/server';
import { getStripe, EMPLOYER_PRICE_ID } from '@/lib/stripe/client';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: employer } = await supabase
    .from('employer_accounts')
    .select('id, company_name')
    .eq('user_id', user.id)
    .single();

  if (!employer) {
    return NextResponse.json({ error: 'Employer account required' }, { status: 400 });
  }

  const stripe = getStripe();
  const service = createServiceClient();

  const { data: existingSub } = await service
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('employer_id', employer.id)
    .maybeSingle();

  let customerId = existingSub?.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { employer_id: employer.id, user_id: user.id },
    });
    customerId = customer.id;

    await service.from('subscriptions').upsert({
      employer_id: employer.id,
      stripe_customer_id: customerId,
      status: 'incomplete',
    }, { onConflict: 'employer_id' });
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: EMPLOYER_PRICE_ID, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/employer/billing?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/employer/billing?canceled=true`,
    metadata: { employer_id: employer.id },
  });

  return NextResponse.json({ url: session.url });
}
