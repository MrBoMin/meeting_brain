import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const EMBED_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent";
const SIMILARITY_THRESHOLD = 0.65;
const MAX_RELATED = 5;

async function embed(
  text: string,
  geminiKey: string
): Promise<number[] | null> {
  const trimmed = text.slice(0, 4000);
  try {
    const res = await fetch(`${EMBED_URL}?key=${geminiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/gemini-embedding-001",
        content: { parts: [{ text: trimmed }] },
      }),
    });
    if (!res.ok) {
      console.error("Embed error:", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return data.embedding?.values ?? null;
  } catch (e) {
    console.error("Embed fetch error:", e);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const geminiKey = Deno.env.get("GEMINI_API_KEY")!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const steps: string[] = [];

  let meetingId: string;
  try {
    const body = await req.json();
    meetingId = body.meeting_id;
    if (!meetingId) throw new Error("missing");
  } catch {
    return new Response(JSON.stringify({ error: "meeting_id required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    steps.push("1. Fetching meeting data");
    const { data: meeting, error: mErr } = await supabase
      .from("meetings")
      .select("id, user_id, title, language_code")
      .eq("id", meetingId)
      .single();
    if (mErr || !meeting) throw new Error("Meeting not found: " + mErr?.message);

    const { data: note } = await supabase
      .from("meeting_notes")
      .select("summary, decisions, open_questions")
      .eq("meeting_id", meetingId)
      .maybeSingle();

    const { data: actions } = await supabase
      .from("action_items")
      .select("task, owner, priority")
      .eq("meeting_id", meetingId);

    const { data: transcripts } = await supabase
      .from("transcripts")
      .select("text")
      .eq("meeting_id", meetingId)
      .order("start_seconds", { ascending: true });

    steps.push(`   Note: ${note ? "yes" : "no"}, Actions: ${(actions || []).length}, Segments: ${(transcripts || []).length}`);

    steps.push("2. Removing old nodes/edges for this meeting");
    const { data: oldNodes } = await supabase
      .from("nodes")
      .select("id")
      .eq("source_meeting_id", meetingId);
    if (oldNodes && oldNodes.length > 0) {
      const oldIds = oldNodes.map((n: { id: string }) => n.id);
      await supabase.from("edges").delete().in("from_node", oldIds);
      await supabase.from("edges").delete().in("to_node", oldIds);
      await supabase.from("nodes").delete().eq("source_meeting_id", meetingId);
      steps.push(`   Removed ${oldNodes.length} old nodes`);
    }

    steps.push("3. Creating nodes + embeddings");
    const nodesToInsert: Array<{
      user_id: string;
      node_type: string;
      title: string;
      content: string;
      embedding: number[] | null;
      source_meeting_id: string;
    }> = [];

    const fullText = (transcripts || []).map((t: { text: string }) => t.text).join(" ");
    const meetingContent = note?.summary
      ? `${note.summary}\n\n${fullText.slice(0, 2000)}`
      : fullText.slice(0, 3000);

    const meetingEmbed = await embed(
      `${meeting.title}: ${meetingContent}`,
      geminiKey
    );
    nodesToInsert.push({
      user_id: meeting.user_id,
      node_type: "meeting",
      title: meeting.title,
      content: meetingContent,
      embedding: meetingEmbed,
      source_meeting_id: meetingId,
    });
    steps.push(`   Meeting node embedded: ${meetingEmbed ? "yes" : "no"}`);

    if (note?.summary) {
      const noteEmbed = await embed(note.summary, geminiKey);
      nodesToInsert.push({
        user_id: meeting.user_id,
        node_type: "note",
        title: `Summary: ${meeting.title}`,
        content: note.summary,
        embedding: noteEmbed,
        source_meeting_id: meetingId,
      });
    }

    const decisions = (note?.decisions || []) as string[];
    for (const dec of decisions) {
      const decEmbed = await embed(dec, geminiKey);
      nodesToInsert.push({
        user_id: meeting.user_id,
        node_type: "decision",
        title: dec.length > 80 ? dec.slice(0, 80) + "..." : dec,
        content: dec,
        embedding: decEmbed,
        source_meeting_id: meetingId,
      });
    }

    for (const action of actions || []) {
      const actText = `${action.task} (owner: ${action.owner || "unassigned"}, priority: ${action.priority})`;
      const actEmbed = await embed(actText, geminiKey);
      nodesToInsert.push({
        user_id: meeting.user_id,
        node_type: "action",
        title: action.task.length > 80 ? action.task.slice(0, 80) + "..." : action.task,
        content: actText,
        embedding: actEmbed,
        source_meeting_id: meetingId,
      });
    }

    steps.push(`   Total nodes: ${nodesToInsert.length}`);

    steps.push("4. Saving nodes");
    const { data: insertedNodes, error: nErr } = await supabase
      .from("nodes")
      .insert(nodesToInsert)
      .select("id, node_type, embedding");
    if (nErr) throw new Error("Insert nodes failed: " + nErr.message);
    steps.push(`   Saved ${(insertedNodes || []).length} nodes`);

    steps.push("5. Finding related nodes");
    const edgesToInsert: Array<{
      from_node: string;
      to_node: string;
      relation: string;
      strength: number;
    }> = [];

    for (const node of insertedNodes || []) {
      if (!node.embedding) continue;

      const { data: similar } = await supabase.rpc("search_nodes", {
        query_embedding: node.embedding,
        match_user_id: meeting.user_id,
        match_count: MAX_RELATED + 5,
        match_threshold: SIMILARITY_THRESHOLD,
      });

      for (const match of similar || []) {
        if (match.id === node.id) continue;
        const alreadyHasEdge = edgesToInsert.some(
          (e) =>
            (e.from_node === node.id && e.to_node === match.id) ||
            (e.from_node === match.id && e.to_node === node.id)
        );
        if (alreadyHasEdge) continue;

        let relation = "references";
        if (node.node_type === "meeting" && match.node_type === "meeting") {
          relation = "continues";
        } else if (node.node_type === "decision" && match.node_type === "decision") {
          relation = match.similarity > 0.85 ? "resolves" : "references";
        }

        edgesToInsert.push({
          from_node: node.id,
          to_node: match.id,
          relation,
          strength: Math.round(match.similarity * 100) / 100,
        });

        if (edgesToInsert.length >= MAX_RELATED * nodesToInsert.length) break;
      }
    }

    steps.push(`   Found ${edgesToInsert.length} edges`);

    if (edgesToInsert.length > 0) {
      steps.push("6. Saving edges");
      const { error: eErr } = await supabase.from("edges").insert(edgesToInsert);
      if (eErr) throw new Error("Insert edges failed: " + eErr.message);
      steps.push(`   Saved ${edgesToInsert.length} edges`);
    } else {
      steps.push("6. No edges to save");
    }

    steps.push("7. Updating status to done");
    await supabase
      .from("meetings")
      .update({ status: "done" })
      .eq("id", meetingId);

    steps.push("8. Done");
    return new Response(
      JSON.stringify({
        success: true,
        nodes_count: (insertedNodes || []).length,
        edges_count: edgesToInsert.length,
        steps,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    steps.push("ERROR: " + msg);
    steps.push("Setting status to done (linking is best-effort)");
    try {
      await supabase
        .from("meetings")
        .update({ status: "done" })
        .eq("id", meetingId);
    } catch (_) {}
    return new Response(JSON.stringify({ error: msg, steps }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
