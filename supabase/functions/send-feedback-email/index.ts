import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const notificationEmail = Deno.env.get("FEEDBACK_NOTIFICATION_EMAIL");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FeedbackRequest {
  name: string;
  email: string;
  category: string;
  message: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, email, category, message }: FeedbackRequest = await req.json();

    // Validate input
    if (!name || !email || !category || !message) {
      return new Response(
        JSON.stringify({ error: "All fields are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Store feedback in database
    const { error: dbError } = await supabase.from("feedback").insert({
      name,
      email,
      category,
      message,
    });

    if (dbError) {
      console.error("Database error:", dbError);
      return new Response(
        JSON.stringify({ error: "Failed to save feedback" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Feedback saved to database successfully");

    // Send email notification using Resend API directly
    if (notificationEmail && RESEND_API_KEY) {
      const categoryLabels: Record<string, string> = {
        comment: "Comment",
        suggestion: "Suggestion",
        bug: "Bug Report",
        other: "Other",
      };

      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Trade Journal <onboarding@resend.dev>",
          to: [notificationEmail],
          subject: `New Feedback: ${categoryLabels[category] || category}`,
          html: `
            <h2>New Feedback Received</h2>
            <p><strong>From:</strong> ${name} (${email})</p>
            <p><strong>Category:</strong> ${categoryLabels[category] || category}</p>
            <hr />
            <p><strong>Message:</strong></p>
            <p>${message.replace(/\n/g, "<br>")}</p>
            <hr />
            <p style="color: #666; font-size: 12px;">This feedback was submitted via the Trade Journal app.</p>
          `,
        }),
      });

      const emailResult = await emailResponse.json();
      console.log("Email sent successfully:", emailResult);
    } else {
      console.warn("FEEDBACK_NOTIFICATION_EMAIL or RESEND_API_KEY not set, skipping email notification");
    }

    return new Response(
      JSON.stringify({ success: true, message: "Feedback submitted successfully" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-feedback-email function:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
