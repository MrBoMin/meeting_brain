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

    steps.push("2. Downloading audio from storage");
    const { data: audioBlob, error: dlErr } = await supabase.storage
      .from("meeting-audio")
      .download(meeting.audio_path);
    if (dlErr || !audioBlob) throw new Error("Download failed: " + dlErr?.message);

    const audioBytes = new Uint8Array(await audioBlob.arrayBuffer());
    const fileSizeMB = (audioBytes.length / (1024 * 1024)).toFixed(2);
    steps.push("   Size: " + audioBytes.length + " bytes (" + fileSizeMB + " MB)");

    const mime = meeting.audio_path.endsWith(".wav") ? "audio/wav" : "audio/mp4";
    const lang = meeting.language_code === "my-MM" ? "Burmese" :
                 meeting.language_code === "en-US" ? "English" : meeting.language_code;

    let fileUri: string | null = null;
    let audioBase64: string | null = null;

    // Use File API for files > 4MB, inline for smaller
    if (audioBytes.length > 4 * 1024 * 1024) {
      steps.push("3. Uploading to Gemini File API (large file)");

      // Step 1: Start resumable upload
      const startRes = await fetch(
        "https://generativelanguage.googleapis.com/upload/v1beta/files?key=" + geminiKey,
        {
          method: "POST",
          headers: {
            "X-Goog-Upload-Protocol": "resumable",
            "X-Goog-Upload-Command": "start",
            "X-Goog-Upload-Header-Content-Length": String(audioBytes.length),
            "X-Goog-Upload-Header-Content-Type": mime,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            file: { displayName: meetingId + (mime === "audio/wav" ? ".wav" : ".m4a") },
          }),
        }
      );
      if (!startRes.ok) {
        const errText = await startRes.text();
        throw new Error("File API start failed (" + startRes.status + "): " + errText);
      }
      const uploadUrl = startRes.headers.get("X-Goog-Upload-URL");
      if (!uploadUrl) throw new Error("No upload URL returned");

      // Step 2: Upload the bytes
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Length": String(audioBytes.length),
          "X-Goog-Upload-Offset": "0",
          "X-Goog-Upload-Command": "upload, finalize",
        },
        body: audioBytes,
      });
      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        throw new Error("File upload failed (" + uploadRes.status + "): " + errText);
      }
      const fileInfo = await uploadRes.json();
      fileUri = fileInfo.file?.uri;
      if (!fileUri) throw new Error("No file URI: " + JSON.stringify(fileInfo));
      steps.push("   Uploaded: " + fileUri);

      // Step 3: Wait for file to be ACTIVE
      const fileName = fileInfo.file?.name;
      if (fileName) {
        for (let i = 0; i < 30; i++) {
          const checkRes = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/" + fileName + "?key=" + geminiKey
          );
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            if (checkData.state === "ACTIVE") {
              steps.push("   File state: ACTIVE");
              break;
            }
            steps.push("   File state: " + checkData.state + " (waiting...)");
          }
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    } else {
      steps.push("3. Encoding inline base64 (small file)");
      let bin = "";
      for (let i = 0; i < audioBytes.length; i += 8192) {
        bin += String.fromCharCode.apply(null, Array.from(audioBytes.subarray(i, i + 8192)));
      }
      audioBase64 = btoa(bin);
      steps.push("   Base64 length: " + audioBase64.length);
    }

    steps.push("4. Calling Gemini for transcription");
    const prompt = "Transcribe this audio recording accurately. The primary language is " + lang + " (" + meeting.language_code + "). Output ONLY the transcription text. Preserve the original language. If multiple speakers, prefix with Speaker 1:, Speaker 2:, etc. If unclear or silent, output [inaudible].";

    const audioPart = fileUri
      ? { fileData: { mimeType: mime, fileUri: fileUri } }
      : { inlineData: { mimeType: mime, data: audioBase64 } };

    const genUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=" + geminiKey;

    const res = await fetch(genUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [audioPart, { text: prompt }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 16384 },
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
    steps.push("   Chars: " + transcript.length);
    if (transcript) {
      steps.push("   Preview: " + transcript.substring(0, 200));
    } else {
      steps.push("   Raw: " + JSON.stringify(candidate || data).substring(0, 500));
    }

    steps.push("5. Parsing");
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

    steps.push("6. Saving");
    var insertRes = await supabase.from("transcripts").insert(segments);
    if (insertRes.error) throw new Error("Insert failed: " + insertRes.error.message);
    steps.push("   Saved");

    steps.push("7. Setting status to analyzing");
    await supabase.from("meetings").update({ status: "analyzing" }).eq("id", meetingId);
    steps.push("   Status updated");

    // Cleanup: delete uploaded file from Gemini if we used File API
    if (fileUri) {
      try {
        const fileName = fileUri.split("/").pop();
        await fetch(
          "https://generativelanguage.googleapis.com/v1beta/files/" + fileName + "?key=" + geminiKey,
          { method: "DELETE" }
        );
      } catch (_) { /* best effort cleanup */ }
    }

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
