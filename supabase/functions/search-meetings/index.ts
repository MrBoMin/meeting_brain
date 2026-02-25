import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const EMBED_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const geminiKey = Deno.env.get("GEMINI_API_KEY")!;

  let query: string;
  let userId: string;
  let limit: number;
  try {
    const body = await req.json();
    query = body.query;
    userId = body.user_id;
    limit = body.limit || 10;
    if (!query || !userId) throw new Error("missing");
  } catch {
    return new Response(
      JSON.stringify({ error: "query and user_id required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const embedRes = await fetch(`${EMBED_URL}?key=${geminiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/gemini-embedding-001",
        content: { parts: [{ text: query.slice(0, 2000) }] },
      }),
    });

    if (!embedRes.ok) {
      const errText = await embedRes.text();
      throw new Error("Embedding failed: " + errText);
    }

    const embedData = await embedRes.json();
    const embedding = embedData.embedding?.values;
    if (!embedding) throw new Error("No embedding returned");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: results, error } = await supabase.rpc("search_nodes", {
      query_embedding: embedding,
      match_user_id: userId,
      match_count: limit,
      match_threshold: 0.65,
    });

    if (error) throw new Error("Search failed: " + error.message);

    const enriched = [];
    for (const r of results || []) {
      let meetingTitle = null;
      let meetingDate = null;
      if (r.source_meeting_id) {
        const { data: m } = await supabase
          .from("meetings")
          .select("title, created_at")
          .eq("id", r.source_meeting_id)
          .maybeSingle();
        if (m) {
          meetingTitle = m.title;
          meetingDate = m.created_at;
        }
      }
      enriched.push({
        ...r,
        meeting_title: meetingTitle,
        meeting_date: meetingDate,
      });
    }

    return new Response(
      JSON.stringify({ results: enriched, count: enriched.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
