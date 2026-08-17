import { useRef, useState, useCallback, useEffect } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { convertBlobToWav } from './panels/audio/audioEncoding';

interface VoiceInputProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
  sttModelId?: string | null;
}

export function VoiceInput({ onTranscription, disabled, sttModelId }: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4',
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());

        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        setIsProcessing(true);

        try {
          // Convert to WAV for compatibility with the Qwen3 ASR service
          const wavFile = await convertBlobToWav(blob);

          // Read the WAV file as a base64 data URL
          const reader = new FileReader();
          const audioDataUrl = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('Failed to read audio file'));
            reader.readAsDataURL(wavFile);
          });

          // Send to the existing /api/audio/transcribe endpoint (JSON + base64)
          const response = await fetch('/api/audio/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              modelId: sttModelId || 'qwen3-asr',
              audioData: audioDataUrl,
              params: {
                language: 'auto',
                translate: false,
              },
            }),
          });

          const data = await response.json();

          if (data.success && data.data?.text) {
            onTranscription(data.data.text);
          } else {
            const errorMsg = data.error || 'Transcription returned no text';
            console.error('STT failed:', errorMsg);
            setError(errorMsg);
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error during transcription';
          console.error('STT failed:', errorMsg);
          setError(errorMsg);
        } finally {
          setIsProcessing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Microphone access denied';
      console.error('Microphone access denied:', errorMsg);
      setError(errorMsg);
    }
  }, [onTranscription, sttModelId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <button
        className={`orch-voice-btn${isRecording ? ' recording' : ''}`}
        onClick={isRecording ? stopRecording : startRecording}
        disabled={disabled || isProcessing}
        title={isRecording ? 'Stop recording' : 'Start voice input'}
      >
        {isProcessing ? (
          <Loader2 size={16} className="spin" />
        ) : isRecording ? (
          <MicOff size={16} />
        ) : (
          <Mic size={16} />
        )}
      </button>
      {error && (
        <span style={{ fontSize: 11, color: 'var(--red, #e74c3c)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {error}
        </span>
      )}
    </div>
  );
}