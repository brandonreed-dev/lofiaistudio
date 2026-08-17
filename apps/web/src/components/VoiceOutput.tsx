import { useState, useRef, useCallback } from 'react';
import { Volume2, VolumeX, Loader2 } from 'lucide-react';

interface VoiceOutputProps {
  text: string;
  ttsModelId?: string | null;
  disabled?: boolean;
}

export function VoiceOutput({ text, ttsModelId, disabled }: VoiceOutputProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playTTS = useCallback(async () => {
    setError(null);

    // Toggle off if currently playing
    if (isPlaying) {
      audioRef.current?.pause();
      audioRef.current = null;
      setIsPlaying(false);
      return;
    }

    setIsLoading(true);
    try {
      // Use the existing /api/audio/synthesize endpoint (JSON + base64 response)
      const response = await fetch('/api/audio/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: ttsModelId || 'default',
          text,
          params: {
            speed: 1.0,
            pitch: 1.0,
            outputFormat: 'wav',
          },
        }),
      });

      const data = await response.json();

      if (data.success && data.data?.audioFile) {
        const audio = new Audio(data.data.audioFile);
        audioRef.current = audio;
        audio.onended = () => {
          setIsPlaying(false);
          audioRef.current = null;
        };
        audio.onerror = () => {
          setIsPlaying(false);
          audioRef.current = null;
          setError('Failed to play audio');
        };
        audio.play();
        setIsPlaying(true);
      } else {
        const errorMsg = data.error || 'Synthesis returned no audio';
        console.error('TTS failed:', errorMsg);
        setError(errorMsg);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error during synthesis';
      console.error('TTS failed:', errorMsg);
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [text, ttsModelId, isPlaying]);

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <button
        className="orch-icon-btn"
        onClick={playTTS}
        disabled={disabled || isLoading || !text.trim()}
        title={isPlaying ? 'Stop' : 'Read aloud'}
        style={{ width: 24, height: 24 }}
      >
        {isLoading ? (
          <Loader2 size={12} className="spin" />
        ) : isPlaying ? (
          <VolumeX size={12} />
        ) : (
          <Volume2 size={12} />
        )}
      </button>
      {error && (
        <span style={{ fontSize: 10, color: 'var(--red, #e74c3c)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {error}
        </span>
      )}
    </div>
  );
}