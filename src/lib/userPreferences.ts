import { supabase } from '@/integrations/supabase/client';

export async function fetchUserPreference(userId: string, key: string) {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('value')
    .eq('user_id', userId)
    .eq('key', key)
    .single();

  if (error) {
    console.error('Error fetching user preference:', error);
    return null;
  }

  return data?.value ?? null;
}

export async function setUserPreference(userId: string, key: string, value: any) {
  const { data, error } = await supabase
    .from('user_preferences')
    .upsert({ user_id: userId, key, value }, { onConflict: ['user_id', 'key'] })
    .select();

  if (error) {
    console.error('Error setting user preference:', error);
    return null;
  }

  return data?.[0] ?? null;
}
