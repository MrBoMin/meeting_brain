import { useState, useRef, useCallback, useEffect } from 'react';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';

interface RecordingResult {
  uri: string;
  durationSeconds: number;
}

export function useRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    const result = await Audio.requestPermissionsAsync();
    setPermissionGranted(result.granted);
    return result.granted;
  }, []);

  const startRecording = useCallback(async (): Promise<void> => {
    const hasPermission = permissionGranted || (await requestPermission());
    if (!hasPermission) {
      throw new Error('Microphone permission not granted');
    }

    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch {}
      recordingRef.current = null;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      ...(Platform.OS === 'android' && {
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      }),
    });

    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );

    recordingRef.current = recording;
    startTimeRef.current = Date.now();
    setIsRecording(true);
    setDuration(0);

    timerRef.current = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
  }, [permissionGranted, requestPermission]);

  const stopRecording = useCallback(async (): Promise<RecordingResult> => {
    if (!recordingRef.current) {
      throw new Error('No active recording');
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const recording = recordingRef.current;
    const uri = recording.getURI();

    await recording.stopAndUnloadAsync();

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
    });

    if (!uri) throw new Error('Recording URI not available');

    const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);

    recordingRef.current = null;
    setIsRecording(false);

    return { uri, durationSeconds };
  }, []);

  return {
    isRecording,
    duration,
    permissionGranted,
    startRecording,
    stopRecording,
    requestPermission,
  };
}
