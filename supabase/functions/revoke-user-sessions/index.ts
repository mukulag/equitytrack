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

    // Use the admin API to sign out the user (revokes all sessions)
    const { error } = await supabase.auth.admin.signOut(user_id, 'global');

    if (error) {
      console.error('Error revoking sessions:', error);
      return new Response(JSON.stringify({ error: 'Failed to revoke sessions' }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error('Error in revoke-user-sessions:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
};