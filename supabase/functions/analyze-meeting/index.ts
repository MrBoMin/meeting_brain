import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
    steps.push("1. Fetching transcripts");
    const { data: transcripts, error: tErr } = await supabase
      .from("transcripts")
      .select("speaker_label, text, language")
      .eq("meeting_id", meetingId)
      .order("start_seconds", { ascending: true });

    if (tErr) throw new Error("Transcript fetch failed: " + tErr.message);
    if (!transcripts || transcripts.length === 0) {
      throw new Error("No transcripts found for this meeting");
    }
    steps.push("   Segments: " + transcripts.length);

    const fullTranscript = transcripts
      .map((t: { speaker_label: string | null; text: string }) =>
        t.speaker_label ? `${t.speaker_label}: ${t.text}` : t.text
      )
      .join("\n");
    steps.push("   Transcript chars: " + fullTranscript.length);

    const language = transcripts[0].language || "en-US";
    const langName =
      language === "my-MM" ? "Burmese" :
      language === "en-US" ? "English" : language;

    steps.push("2. Calling Gemini for analysis");
    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
      geminiKey;

    const prompt = `You are an expert meeting analyst. Analyze the following meeting transcript and extract structured information.

The transcript is in ${langName}. Respond in the SAME language as the transcript.

Return your analysis as valid JSON with this exact structure:
{
  "summary": "A concise 2-4 sentence summary of the meeting's key points and outcomes",
  "action_items": [
    {
      "task": "Description of the task",
      "owner": "Person responsible (use speaker label if name unknown, or null)",
      "priority": "high" | "medium" | "low",
      "deadline": null
    }
  ],
  "decisions": [
    "Decision 1 that was made",
    "Decision 2 that was made"
  ],
  "open_questions": [
    "Unresolved question 1",
    "Unresolved question 2"
  ]
}

Rules:
- Output ONLY valid JSON, no markdown code fences, no extra text
- If no action items/decisions/open questions were found, use empty arrays []
- Priority should be "high" for urgent/critical items, "medium" for standard tasks, "low" for nice-to-haves
- Keep the summary focused and actionable
- Preserve the original language of the transcript in your analysis

Transcript:
${fullTranscript}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
      }),
    });

    const resText = await res.text();
    if (!res.ok) throw new Error("Gemini failed (" + res.status + "): " + resText);

    const data = JSON.parse(resText);
    const candidate = data.candidates && data.candidates[0];
    const parts = candidate && candidate.content && candidate.content.parts;
    const rawText = (parts && parts[0] && parts[0].text) || "";
    steps.push("   Response chars: " + rawText.length);

    steps.push("3. Parsing analysis");
    const jsonStr = rawText
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    let analysis: {
      summary: string;
      action_items: Array<{
        task: string;
        owner: string | null;
        priority: string;
        deadline: string | null;
      }>;
      decisions: string[];
      open_questions: string[];
    };

    try {
      analysis = JSON.parse(jsonStr);
    } catch (parseErr) {
      steps.push("   Parse error, attempting extraction from raw text");
      analysis = {
        summary: rawText.substring(0, 500),
        action_items: [],
        decisions: [],
        open_questions: [],
      };
    }

    steps.push("   Summary length: " + (analysis.summary || "").length);
    steps.push("   Action items: " + (analysis.action_items || []).length);
    steps.push("   Decisions: " + (analysis.decisions || []).length);
    steps.push("   Open questions: " + (analysis.open_questions || []).length);

    steps.push("4. Saving meeting note");
    const { error: noteErr } = await supabase.from("meeting_notes").upsert(
      {
        meeting_id: meetingId,
        summary: analysis.summary || "No summary generated",
        decisions: analysis.decisions || [],
        open_questions: analysis.open_questions || [],
        raw_analysis: analysis,
        model_version: "gemini-2.5-flash",
      },
      { onConflict: "meeting_id" }
    );
    if (noteErr) throw new Error("Save note failed: " + noteErr.message);
    steps.push("   Note saved");

    steps.push("5. Saving action items");
    const actionItems = (analysis.action_items || []).map(
      (item: { task: string; owner: string | null; priority: string; deadline: string | null }) => ({
        meeting_id: meetingId,
        task: item.task,
        owner: item.owner,
        priority: ["high", "medium", "low"].includes(item.priority)
          ? item.priority
          : "medium",
        deadline: item.deadline || null,
        status: "open",
      })
    );

    if (actionItems.length > 0) {
      const { error: aiErr } = await supabase
        .from("action_items")
        .insert(actionItems);
      if (aiErr) throw new Error("Save action items failed: " + aiErr.message);
    }
    steps.push("   Action items saved: " + actionItems.length);

    steps.push("6. Updating meeting status to linking");
    await supabase
      .from("meetings")
      .update({ status: "linking" })
      .eq("id", meetingId);
    steps.push("   Status set to linking");

    return new Response(
      JSON.stringify({
        success: true,
        summary_length: (analysis.summary || "").length,
        action_items_count: actionItems.length,
        decisions_count: (analysis.decisions || []).length,
        steps,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    steps.push("ERROR: " + msg);
    try {
      await supabase
        .from("meetings")
        .update({ status: "failed" })
        .eq("id", meetingId);
    } catch (_) {}
    return new Response(JSON.stringify({ error: msg, steps }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
