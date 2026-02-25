import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';
import { updateMeetingStatus } from './meetingService';

const BUCKET = 'meeting-audio';

export async function uploadMeetingAudio(
  userId: string,
  meetingId: string,
  localUri: string
): Promise<string> {
  const storagePath = `${userId}/${meetingId}.m4a`;

  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, decode(base64), {
      contentType: 'audio/mp4',
      upsert: true,
    });

  if (error) throw error;

  await updateMeetingStatus(meetingId, 'processing', {
    audio_path: storagePath,
    ended_at: new Date().toISOString(),
  });

  return storagePath;
}

async function callEdgeFunction(
  functionName: string,
  meetingId: string,
  maxRetries = 3,
): Promise<boolean> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const url = `${supabaseUrl}/functions/v1/${functionName}`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({ meeting_id: meetingId }),
      });

      const text = await res.text();
      console.log(`${functionName} response (${res.status}):`, text);

      if (res.ok) return true;

      console.warn(`${functionName} attempt ${attempt}/${maxRetries} failed (${res.status}):`, text);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`${functionName} attempt ${attempt}/${maxRetries} network error:`, msg);
    }

    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  console.warn(`All ${functionName} attempts failed`);
  return false;
}

export async function triggerTranscription(meetingId: string): Promise<void> {
  const ok = await callEdgeFunction('transcribe-meeting', meetingId);
  if (!ok) {
    await updateMeetingStatus(meetingId, 'failed');
  }
}

export async function triggerAnalysis(meetingId: string): Promise<void> {
  const ok = await callEdgeFunction('analyze-meeting', meetingId);
  if (!ok) {
    console.warn('Analysis failed, skipping to done');
    await updateMeetingStatus(meetingId, 'done');
  }
}

export async function triggerLinking(meetingId: string): Promise<void> {
  const ok = await callEdgeFunction('link-to-graph', meetingId);
  if (!ok) {
    console.warn('Linking failed, skipping to done');
    await updateMeetingStatus(meetingId, 'done');
  }
}
