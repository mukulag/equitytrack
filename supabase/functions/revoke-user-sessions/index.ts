import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface RevokeRequest {
  user_id: string;
}

export default async (req: Request) => {
  try {
    const { user_id }: RevokeRequest = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id is required' }), { status: 400 });
    }

    // Delete all sessions for this user (requires service role)
    const { error } = await supabase.from('auth.sessions').delete().eq('user_id', user_id);

    if (error) {
      console.error('Error deleting sessions:', error);
      return new Response(JSON.stringify({ error: 'Failed to revoke sessions' }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error('Error in revoke-user-sessions:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
};