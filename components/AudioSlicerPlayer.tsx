
import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { Play, RotateCcw, Volume2 } from 'lucide-react';

interface AudioSlicerPlayerProps {
  audioUrl: string;
  startTime: number;
  endTime: number;
  onPlayStart?: () => void;
  onPlayEnd?: () => void;
}

export interface AudioSlicerPlayerHandle {
  play: () => void;
}

const AudioSlicerPlayer = forwardRef<AudioSlicerPlayerHandle, AudioSlicerPlayerProps>(({ 
  audioUrl, 
  startTime, 
  endTime,
  onPlayStart,
  onPlayEnd 
}, ref) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const checkTimeRef = useRef<(() => void) | null>(null);

  // Expose the play method to the parent
  useImperativeHandle(ref, () => ({
    play: () => handlePlay()
  }));

  useEffect(() => {
    if (audioRef.current) {
      // Pre-position the audio head to the start time (with the 1s buffer)
      audioRef.current.currentTime = Math.max(0, startTime);
    }
  }, [startTime]);

  const handlePlay = () => {
    if (!audioRef.current) return;
    
    // Cleanup previous listener if any
    if (checkTimeRef.current) {
      audioRef.current.removeEventListener('timeupdate', checkTimeRef.current);
    }

    // Set start time exactly as provided by Gemini (which now includes the 1s pre-roll)
    audioRef.current.currentTime = Math.max(0, startTime);
    audioRef.current.play();
    setIsPlaying(true);
    onPlayStart?.();

    const checkTime = () => {
      if (audioRef.current && audioRef.current.currentTime >= endTime) {
        audioRef.current.pause();
        setIsPlaying(false);
        onPlayEnd?.();
        audioRef.current.removeEventListener('timeupdate', checkTime);
        checkTimeRef.current = null;
      }
    };

    checkTimeRef.current = checkTime;
    audioRef.current.addEventListener('timeupdate', checkTime);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current && checkTimeRef.current) {
        audioRef.current.removeEventListener('timeupdate', checkTimeRef.current);
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      <audio ref={audioRef} src={audioUrl} className="hidden" preload="auto" />
      <div className="flex gap-4">
        <button
          onClick={handlePlay}
          className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all shadow-lg ${
            isPlaying ? 'bg-orange-100 text-orange-600 scale-105' : 'bg-orange-500 text-white hover:bg-orange-600 active:scale-95'
          }`}
        >
          {isPlaying ? <Volume2 size={24} className="animate-pulse" /> : <Play size={24} />}
          {isPlaying ? 'Playing...' : 'Play Sentence'}
        </button>
        <button
          onClick={() => {
            if (audioRef.current) {
              handlePlay();
            }
          }}
          className="p-3 text-slate-600 hover:text-orange-500 hover:bg-white border-2 border-slate-200 rounded-full transition-all"
          title="Repeat"
        >
          <RotateCcw size={20} />
        </button>
      </div>
      <p className="text-[10px] text-slate-400 font-mono tracking-tighter">
        {startTime.toFixed(2)}s — {endTime.toFixed(2)}s
      </p>
    </div>
  );
});

export default AudioSlicerPlayer;
