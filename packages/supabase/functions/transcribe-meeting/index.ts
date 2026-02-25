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
    steps.push("1. Fetching meeting");
    const { data: meeting, error: meetingErr } = await supabase
      .from("meetings")
      .select("audio_path, language_code")
      .eq("id", meetingId)
      .single();

    if (meetingErr || !meeting) throw new Error("Not found: " + meetingErr?.message);
    if (!meeting.audio_path) throw new Error("No audio uploaded");
    steps.push("   audio: " + meeting.audio_path);

    steps.push("2. Downloading audio");
    const { data: audioBlob, error: dlErr } = await supabase.storage
      .from("meeting-audio")
      .download(meeting.audio_path);
    if (dlErr || !audioBlob) throw new Error("Download failed: " + dlErr?.message);

    const audioBytes = new Uint8Array(await audioBlob.arrayBuffer());
    steps.push("   Size: " + audioBytes.length + " bytes");

    let bin = "";
    for (let i = 0; i < audioBytes.length; i += 8192) {
      bin += String.fromCharCode.apply(null, Array.from(audioBytes.subarray(i, i + 8192)));
    }
    const audioBase64 = btoa(bin);

    steps.push("3. Calling Gemini");
    const mime = meeting.audio_path.endsWith(".wav") ? "audio/wav" : "audio/mp4";
    const lang = meeting.language_code === "my-MM" ? "Burmese" :
                 meeting.language_code === "en-US" ? "English" : meeting.language_code;

    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + geminiKey;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inlineData: { mimeType: mime, data: audioBase64 } },
            { text: "Transcribe this audio recording accurately. The primary language is " + lang + " (" + meeting.language_code + "). Output ONLY the transcription text. Preserve the original language. If multiple speakers, prefix with Speaker 1:, Speaker 2:, etc. If unclear or silent, output [inaudible]." },
          ],
        }],
        generationConfig: { temperature: 0, maxOutputTokens: 8192 },
      }),
    });

    const resText = await res.text();
    if (!res.ok) throw new Error("Gemini failed (" + res.status + "): " + resText);

    const data = JSON.parse(resText);
    const candidate = data.candidates && data.candidates[0];
    const finishReason = candidate && candidate.finishReason;
    const parts = candidate && candidate.content && candidate.content.parts;
    const transcript = (parts && parts[0] && parts[0].text) || "";
    steps.push("   finishReason: " + (finishReason || "none"));
    steps.push("   parts: " + (parts ? parts.length : 0));
    steps.push("   Chars: " + transcript.length);
    if (transcript) {
      steps.push("   Preview: " + transcript.substring(0, 200));
    } else {
      steps.push("   Raw: " + JSON.stringify(candidate || data).substring(0, 300));
    }

    steps.push("4. Parsing");
    const segments: Array<{
      meeting_id: string; speaker_label: string | null; text: string;
      start_seconds: number; end_seconds: number; confidence: number | null; language: string;
    }> = [];

    if (transcript.trim() && transcript.trim() !== "[inaudible]") {
      var lines = transcript.trim().split("\n");
      for (var li = 0; li < lines.length; li++) {
        var line = lines[li].trim();
        if (!line) continue;
        var spk = line.match(/^(Speaker\s*\d+)\s*:\s*/i);
        segments.push({
          meeting_id: meetingId,
          speaker_label: spk ? spk[1] : null,
          text: spk ? line.replace(spk[0], "").trim() : line,
          start_seconds: 0, end_seconds: 0, confidence: null,
          language: meeting.language_code,
        });
      }
    }

    if (segments.length === 0) {
      segments.push({
        meeting_id: meetingId,
        speaker_label: null,
        text: "[No speech detected in this recording]",
        start_seconds: 0, end_seconds: 0, confidence: null,
        language: meeting.language_code,
      });
    }
    steps.push("   Segments: " + segments.length);

    steps.push("5. Saving");
    var insertRes = await supabase.from("transcripts").insert(segments);
    if (insertRes.error) throw new Error("Insert failed: " + insertRes.error.message);
    steps.push("   Saved");

    steps.push("6. Setting status to analyzing");
    await supabase.from("meetings").update({ status: "analyzing" }).eq("id", meetingId);
    steps.push("   Status updated");

    return new Response(
      JSON.stringify({ success: true, segments_count: segments.length, steps: steps }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    var msg = err instanceof Error ? err.message : String(err);
    steps.push("ERROR: " + msg);
    try { await supabase.from("meetings").update({ status: "failed" }).eq("id", meetingId); } catch (_) {}
    return new Response(
      JSON.stringify({ error: msg, steps: steps }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
