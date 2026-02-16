
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Upload, FileAudio, CheckCircle2, XCircle, ArrowRight, ArrowLeft, ChevronLeft, ChevronRight, Loader2, Music, Sparkles, RefreshCcw, Keyboard } from 'lucide-react';
import { transcribeAndSegment } from './services/geminiService';
import { AudioSegment, AppStatus } from './types';
import AudioSlicerPlayer, { AudioSlicerPlayerHandle } from './components/AudioSlicerPlayer';

interface DiffWord {
  text: string;
  isCorrect: boolean;
}

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [segments, setSegments] = useState<AudioSegment[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; original: string; diff?: DiffWord[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const playerRef = useRef<AudioSlicerPlayerHandle>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        setError("File is too large. Please upload an audio file under 20MB.");
        return;
      }
      setAudioFile(file);
      setAudioUrl(URL.createObjectURL(file));
      setStatus(AppStatus.IDLE);
      setError(null);
    }
  };

  const startProcessing = async () => {
    if (!audioFile) return;

    setIsProcessing(true);
    setError(null);
    setStatus(AppStatus.PROCESSING);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioFile);
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const result = await transcribeAndSegment(base64, audioFile.type);
        
        if (result.length === 0) {
          throw new Error("No sentences detected in the audio.");
        }
        
        setSegments(result);
        setStatus(AppStatus.PRACTICING);
        setCurrentIndex(0);
        setIsProcessing(false);
      };
    } catch (err: any) {
      setError(err.message || "An error occurred during processing.");
      setIsProcessing(false);
      setStatus(AppStatus.IDLE);
    }
  };

  const cleanWord = (word: string) => {
    return word.toLowerCase().replace(/[.,!?;:]/g, "").trim();
  };

  const normalizeText = (text: string) => {
    return text.toLowerCase().replace(/[.,!?;:]/g, "").trim();
  };

  const generateDiff = (original: string, user: string): DiffWord[] => {
    const originalWords = original.split(/\s+/);
    const userWords = user.split(/\s+/).map(cleanWord);
    
    return originalWords.map((word, index) => {
      const cleanedOriginal = cleanWord(word);
      const isCorrect = userWords[index] === cleanedOriginal;
      return { text: word, isCorrect };
    });
  };

  const handleSubmit = useCallback(() => {
    if (!userInput.trim()) return;
    const current = segments[currentIndex];
    const normalizedUser = normalizeText(userInput);
    const normalizedOriginal = normalizeText(current.sentence);
    const isCorrect = normalizedUser === normalizedOriginal;
    
    const diff = generateDiff(current.sentence, userInput);
    setFeedback({ isCorrect, original: current.sentence, diff });
  }, [userInput, segments, currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < segments.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setUserInput('');
      setFeedback(null);
      setTimeout(() => textareaRef.current?.focus(), 50);
    } else {
      setStatus(AppStatus.COMPLETED);
    }
  }, [currentIndex, segments.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setUserInput('');
      setFeedback(null);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [currentIndex]);

  const focusInput = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  useEffect(() => {
    if (status === AppStatus.PRACTICING) {
      focusInput();
    }
  }, [status, currentIndex, focusInput]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (status !== AppStatus.PRACTICING) return;
      const isTyping = document.activeElement === textareaRef.current;
      
      // Space to play sentence if not focused on textarea
      if (e.code === 'Space' && !isTyping) {
        e.preventDefault();
        playerRef.current?.play();
      }

      // Enter logic
      if (e.key === 'Enter' && !e.shiftKey) {
        if (!isTyping) {
          if (feedback?.isCorrect) {
            handleNext();
          } else if (userInput.trim()) {
            handleSubmit();
          }
        }
      }

      // Navigation shortcuts (Left/Right)
      // Only navigate if NOT typing (to allow arrow keys for cursor movement)
      if (!isTyping) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          handlePrev();
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          handleNext();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [status, feedback, userInput, handleSubmit, handleNext, handlePrev]);

  const handleTextareaKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (feedback?.isCorrect) {
        handleNext();
      } else {
        handleSubmit();
      }
    }
    if (e.code === 'Space' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      playerRef.current?.play();
    }
    // Navigation inside textarea using Alt + Arrows to not conflict with cursor movement
    if (e.altKey) {
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            handlePrev();
        }
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            handleNext();
        }
    }
  };

  const currentSegment = segments[currentIndex];

  const progress = useMemo(() => {
    if (segments.length === 0) return 0;
    return ((currentIndex + 1) / segments.length) * 100;
  }, [currentIndex, segments.length]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-orange-500 p-2 rounded-lg text-white">
              <Music size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Dutch Dictation Master</h1>
              <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">Practice Your Listening</p>
            </div>
          </div>
          {status === AppStatus.PRACTICING && (
            <div className="flex items-center gap-4">
              <div className="hidden md:block w-48 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-orange-500 transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-sm font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
                {currentIndex + 1} / {segments.length}
              </span>
            </div>
          )}
        </div>
      </header>

      <main className="flex-grow max-w-4xl mx-auto w-full px-4 py-8">
        {status === AppStatus.IDLE && (
          <div className="max-w-2xl mx-auto text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="space-y-4">
              <h2 className="text-3xl font-extrabold text-slate-900">Step 1: Upload Your Dutch Audio</h2>
              <p className="text-slate-600 text-lg">
                Import any Dutch audio file, and we'll break it down into high-precision segments for you.
              </p>
            </div>

            <label className="relative group block cursor-pointer">
              <div className={`
                border-3 border-dashed rounded-3xl p-12 transition-all
                ${audioFile ? 'border-orange-500 bg-orange-50' : 'border-slate-200 bg-white hover:border-orange-400 hover:bg-slate-50'}
              `}>
                <input type="file" className="hidden" accept="audio/*" onChange={handleFileUpload} />
                <div className="flex flex-col items-center gap-4">
                  <div className={`p-4 rounded-full transition-colors ${audioFile ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-orange-100 group-hover:text-orange-500'}`}>
                    {audioFile ? <FileAudio size={48} /> : <Upload size={48} />}
                  </div>
                  {audioFile ? (
                    <div className="space-y-1">
                      <p className="font-bold text-slate-800">{audioFile.name}</p>
                      <p className="text-sm text-slate-500">{(audioFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="font-bold text-slate-800 text-xl">Click to browse or drag & drop</p>
                      <p className="text-sm text-slate-500">Supports MP3, WAV, M4A up to 20MB</p>
                    </div>
                  )}
                </div>
              </div>
            </label>

            {audioFile && (
              <button
                onClick={startProcessing}
                className="w-full bg-orange-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-orange-200 hover:bg-orange-600 active:scale-95 transition-all flex items-center justify-center gap-2 text-xl"
              >
                <Sparkles size={24} />
                Start Dictation Practice
              </button>
            )}

            {error && (
              <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 flex items-center gap-3">
                <XCircle size={20} />
                <p className="font-medium">{error}</p>
              </div>
            )}
          </div>
        )}

        {status === AppStatus.PROCESSING && (
          <div className="flex flex-col items-center justify-center py-20 space-y-6">
            <div className="relative">
              <Loader2 size={64} className="text-orange-500 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Music size={24} className="text-orange-300" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-slate-800">Analyzing Dutch Audio...</h2>
              <p className="text-slate-500">Gemini AI is generating high-precision sentence segments.</p>
            </div>
          </div>
        )}

        {status === AppStatus.PRACTICING && currentSegment && audioUrl && (
          <div className="max-w-2xl mx-auto space-y-8">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-8">
              
              <div className="flex items-center justify-between w-full gap-4">
                <button 
                  onClick={handlePrev}
                  disabled={currentIndex === 0}
                  className="p-3 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-2xl transition-all disabled:opacity-20 disabled:cursor-not-allowed group"
                  title="Previous Sentence (Left Arrow)"
                >
                  <ChevronLeft size={32} />
                </button>

                <AudioSlicerPlayer 
                  ref={playerRef}
                  audioUrl={audioUrl}
                  startTime={currentSegment.startTime}
                  endTime={currentSegment.endTime}
                  onPlayEnd={focusInput}
                />

                <button 
                  onClick={handleNext}
                  disabled={currentIndex === segments.length - 1}
                  className="p-3 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-2xl transition-all disabled:opacity-20 disabled:cursor-not-allowed"
                  title="Next Sentence (Right Arrow)"
                >
                  <ChevronRight size={32} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-500 uppercase tracking-wider">
                    <Keyboard size={16} />
                    Your Transcription
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono text-right">
                    [Space]: Play | [Enter]: Check/Next <br/>
                    [Arrows]: Nav (when not typing)
                  </span>
                </div>
                <textarea
                  ref={textareaRef}
                  autoFocus
                  value={userInput}
                  onChange={(e) => {
                    setUserInput(e.target.value);
                    if (feedback && !feedback.isCorrect) setFeedback(null);
                  }}
                  onKeyDown={handleTextareaKeyDown}
                  placeholder="Type the Dutch sentence here..."
                  className={`w-full h-32 p-4 text-xl border-2 rounded-2xl focus:ring-0 transition-all resize-none font-medium text-slate-800 ${
                    feedback?.isCorrect 
                      ? 'bg-green-50 border-green-200' 
                      : feedback 
                      ? 'bg-red-50 border-red-200' 
                      : 'bg-slate-50 border-slate-200 focus:border-orange-500'
                  }`}
                  disabled={feedback?.isCorrect}
                />
              </div>

              {!feedback || !feedback.isCorrect ? (
                <button
                  onClick={handleSubmit}
                  disabled={!userInput.trim()}
                  className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-black active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg"
                >
                  {feedback && !feedback.isCorrect ? <RefreshCcw size={24} className="animate-spin-once" /> : <CheckCircle2 size={24} />}
                  {feedback && !feedback.isCorrect ? 'Try Again (Enter)' : 'Check Answer (Enter)'}
                </button>
              ) : null}

              {feedback && (
                <div className="space-y-6 animate-in slide-in-from-top-2 duration-300">
                  <div className={`p-6 rounded-2xl border-2 flex flex-col gap-4 ${
                    feedback.isCorrect 
                      ? 'bg-green-50 border-green-100 text-green-800' 
                      : 'bg-red-50 border-red-100 text-red-800'
                  }`}>
                    <div className="flex items-center gap-3">
                      {feedback.isCorrect ? <CheckCircle2 size={28} /> : <XCircle size={28} />}
                      <h3 className="text-xl font-bold">
                        {feedback.isCorrect ? 'Uitstekend! (Excellent)' : 'Niet helemaal... (Not quite)'}
                      </h3>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-sm font-bold opacity-60 uppercase tracking-widest">
                        {feedback.isCorrect ? 'Sentence Reference' : 'Correction Guide (Bold = Errors)'}
                      </p>
                      <div className="text-2xl font-semibold leading-relaxed flex flex-wrap gap-x-2">
                        {feedback.diff?.map((word, i) => (
                          <span 
                            key={i} 
                            className={`${!word.isCorrect ? 'text-red-600 font-extrabold underline decoration-2' : ''}`}
                          >
                            {word.text}
                          </span>
                        ))}
                      </div>
                    </div>

                    {!feedback.isCorrect && (
                      <p className="font-medium text-sm">Correct the red words and try again!</p>
                    )}
                  </div>

                  {feedback.isCorrect && (
                    <button
                      onClick={handleNext}
                      className="w-full bg-orange-500 text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-orange-600 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-lg"
                    >
                      {currentIndex < segments.length - 1 ? 'Next Sentence (Enter)' : 'Finish Session (Enter)'}
                      <ArrowRight size={24} />
                    </button>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex justify-center">
               <button 
                 onClick={() => {
                   if(window.confirm("Are you sure you want to stop? Progress will be lost.")) {
                     setStatus(AppStatus.IDLE);
                     setAudioFile(null);
                     setSegments([]);
                     setFeedback(null);
                     setUserInput('');
                   }
                 }}
                 className="text-slate-400 hover:text-slate-600 text-sm font-medium transition-colors underline decoration-dotted"
               >
                 Cancel Session
               </button>
            </div>
          </div>
        )}

        {status === AppStatus.COMPLETED && (
          <div className="max-w-xl mx-auto text-center space-y-8 py-10 animate-in fade-in zoom-in duration-500">
            <div className="bg-white p-12 rounded-[40px] shadow-xl border border-slate-100 space-y-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-orange-500" />
              <div className="inline-flex p-6 bg-orange-100 text-orange-600 rounded-full mb-4">
                <CheckCircle2 size={64} />
              </div>
              <h2 className="text-4xl font-black text-slate-900 leading-tight">Gefeliciteerd!<br/>Session Complete</h2>
              <p className="text-slate-600 text-lg max-w-xs mx-auto">
                You've successfully transcribed {segments.length} Dutch sentences.
              </p>
              <div className="pt-6">
                <button
                  onClick={() => {
                    setStatus(AppStatus.IDLE);
                    setAudioFile(null);
                    setSegments([]);
                    setFeedback(null);
                    setUserInput('');
                  }}
                  className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-black transition-all flex items-center justify-center gap-2 text-xl shadow-lg"
                >
                  <Music size={24} />
                  Practice Another Clip
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="py-8 border-t border-slate-200 mt-auto">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-slate-400 text-sm flex items-center justify-center gap-2 font-medium">
            Powered by Gemini AI • Learn Dutch Effortlessly
          </p>
        </div>
      </footer>

      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(250%); }
        }
        .animate-spin-once {
          animation: spin 0.5s ease-in-out;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default App;
