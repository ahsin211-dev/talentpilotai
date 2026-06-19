import { createServiceClient } from '@/lib/supabase/admin';

export interface OccupationMatch {
  id: string;
  code: string;
  title: string;
}

/** Resolve occupation code string from AI output to database record. */
export async function resolveOccupationCode(
  code: string | null,
  title: string | null
): Promise<OccupationMatch | null> {
  const supabase = createServiceClient();

  if (code) {
    const { data } = await supabase
      .from('occupation_codes')
      .select('id, code, title')
      .eq('code', code)
      .eq('is_active', true)
      .maybeSingle();
    if (data) return data;
  }

  if (title) {
    const { data } = await supabase
      .from('occupation_codes')
      .select('id, code, title')
      .ilike('title', `%${title}%`)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    if (data) return data;
  }

  return null;
}
