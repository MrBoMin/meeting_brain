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

export async function triggerTranscription(meetingId: string): Promise<void> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const url = `${supabaseUrl}/functions/v1/transcribe-meeting`;

  const maxRetries = 3;
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
      console.log(`Transcription response (${res.status}):`, text);

      if (res.ok) return;

      console.warn(`Transcription attempt ${attempt}/${maxRetries} failed (${res.status}):`, text);
    } catch (e: any) {
      console.warn(`Transcription attempt ${attempt}/${maxRetries} network error:`, e.message);
    }

    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  console.warn('All transcription attempts failed, processing screen will poll for status');
}

export async function triggerAnalysis(meetingId: string): Promise<void> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const url = `${supabaseUrl}/functions/v1/analyze-meeting`;

  const maxRetries = 3;
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
      console.log(`Analysis response (${res.status}):`, text);

      if (res.ok) return;

      console.warn(`Analysis attempt ${attempt}/${maxRetries} failed (${res.status}):`, text);
    } catch (e: any) {
      console.warn(`Analysis attempt ${attempt}/${maxRetries} network error:`, e.message);
    }

    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  console.warn('All analysis attempts failed');
}

export async function triggerLinking(meetingId: string): Promise<void> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const url = `${supabaseUrl}/functions/v1/link-to-graph`;

  const maxRetries = 3;
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
      console.log(`Linking response (${res.status}):`, text);

      if (res.ok) return;

      console.warn(`Linking attempt ${attempt}/${maxRetries} failed (${res.status}):`, text);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`Linking attempt ${attempt}/${maxRetries} network error:`, msg);
    }

    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  console.warn('All linking attempts failed');
}
