import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type VoiceState = 'IDLE' | 'GREETING' | 'LISTENING' | 'PROCESSING' | 'CLARIFYING' | 'SEARCHING';

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface SearchResult {
  query: string;
  type: 'product' | 'restaurant' | 'cinema' | 'attraction';
}

interface ParsedIntent {
  searches: SearchResult[];
  needsClarification: boolean;
  clarifyField?: string;
  clarifyingQuestion?: string;
  isInappropriate?: boolean;
  isOffTopic?: boolean;
}

interface SunnyVoiceProps {
  onSearch: (query: string, type?: string) => void;
  hasResults?: boolean;
  className?: string;
}

export function SunnyVoice({ onSearch, hasResults = false, className }: SunnyVoiceProps) {
  const [state, setState] = useState<VoiceState>('IDLE');
  const [statusText, setStatusText] = useState<string>('');
  const [conversationContext, setConversationContext] = useState<ConversationMessage[]>([]);
  const [isFirstInteraction, setIsFirstInteraction] = useState(true);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const speak = useCallback(async (text: string): Promise<void> => {
    try {
      const response = await fetch('/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: 'shimmer' })
      });
      
      if (!response.ok) {
        console.error('TTS failed:', await response.text());
        return;
      }
      
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        await audioRef.current.play();
        
        await new Promise<void>((resolve) => {
          if (audioRef.current) {
            audioRef.current.onended = () => resolve();
          } else {
            resolve();
          }
        });
        
        URL.revokeObjectURL(audioUrl);
      }
    } catch (error) {
      console.error('TTS error:', error);
    }
  }, []);

  const transcribe = useCallback(async (audioBlob: Blob): Promise<string> => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    
    const response = await fetch('/api/voice/stt', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error('Transcription failed');
    }
    
    const { text } = await response.json();
    return text;
  }, []);

  const parseIntent = useCallback(async (text: string, context: ConversationMessage[]): Promise<ParsedIntent> => {
    const response = await fetch('/api/voice/parse-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, context })
    });
    
    if (!response.ok) {
      throw new Error('Intent parsing failed');
    }
    
    return response.json();
  }, []);

  const recordAudio = useCallback((): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          streamRef.current = stream;
          const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
          mediaRecorderRef.current = mediaRecorder;
          const chunks: Blob[] = [];
          
          mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              chunks.push(e.data);
            }
          };
          
          mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'audio/webm' });
            stream.getTracks().forEach(track => track.stop());
            streamRef.current = null;
            resolve(blob);
          };

          mediaRecorder.onerror = (e) => {
            stream.getTracks().forEach(track => track.stop());
            streamRef.current = null;
            reject(e);
          };

          mediaRecorder.start();
        })
        .catch(reject);
    });
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const getGreeting = useCallback(async (): Promise<string> => {
    const response = await fetch(`/api/voice/greeting?first=${isFirstInteraction}`);
    const { greeting } = await response.json();
    return greeting;
  }, [isFirstInteraction]);

  const getTransition = useCallback(async (): Promise<string> => {
    const response = await fetch('/api/voice/transition');
    const { transition } = await response.json();
    return transition;
  }, []);

  const getErrorMessage = useCallback(async (type: string): Promise<string> => {
    const response = await fetch(`/api/voice/error?type=${type}`);
    const { message } = await response.json();
    return message;
  }, []);

  const handleMicClick = useCallback(async () => {
    if (state !== 'IDLE') {
      if (state === 'LISTENING') {
        stopRecording();
      }
      return;
    }

    try {
      setState('GREETING');
      setStatusText('Sunny is speaking...');
      
      const greeting = await getGreeting();
      await speak(greeting);
      setIsFirstInteraction(false);

      setState('LISTENING');
      setStatusText('Listening...');
      
      const recordingPromise = recordAudio();
      
      setTimeout(() => {
        stopRecording();
      }, 8000);
      
      const audioBlob = await recordingPromise;
      
      setState('PROCESSING');
      setStatusText('Processing...');
      
      const userText = await transcribe(audioBlob);
      
      if (!userText || userText.trim().length === 0) {
        const errorMsg = await getErrorMessage('not_understood');
        await speak(errorMsg);
        setState('IDLE');
        setStatusText('');
        return;
      }
      
      const newContext: ConversationMessage[] = [...conversationContext, { role: 'user', content: userText }];
      setConversationContext(newContext);

      const intent = await parseIntent(userText, conversationContext);

      if (intent.isInappropriate) {
        const errorMsg = await getErrorMessage('inappropriate');
        await speak(errorMsg);
        setState('IDLE');
        setStatusText('');
        return;
      }

      if (intent.isOffTopic) {
        const errorMsg = await getErrorMessage('off_topic');
        await speak(errorMsg);
        setState('IDLE');
        setStatusText('');
        return;
      }

      if (intent.needsClarification && intent.clarifyingQuestion) {
        setState('CLARIFYING');
        setStatusText('Sunny needs more info...');
        await speak(intent.clarifyingQuestion);
        
        setState('LISTENING');
        setStatusText('Listening...');
        
        const clarifyRecordingPromise = recordAudio();
        setTimeout(() => stopRecording(), 8000);
        const clarifyAudioBlob = await clarifyRecordingPromise;
        
        setState('PROCESSING');
        setStatusText('Processing...');
        
        const clarifyText = await transcribe(clarifyAudioBlob);
        const updatedContext: ConversationMessage[] = [...newContext, { role: 'user', content: clarifyText }];
        setConversationContext(updatedContext);
        
        const finalIntent = await parseIntent(clarifyText, newContext);
        intent.searches = finalIntent.searches;
      }

      if (intent.searches && intent.searches.length > 0) {
        setState('SEARCHING');
        setStatusText('Searching...');
        
        const transition = await getTransition();
        await speak(transition);

        for (const search of intent.searches) {
          onSearch(search.query, search.type);
        }
      } else {
        const errorMsg = await getErrorMessage('no_results');
        await speak(errorMsg);
      }

      setState('IDLE');
      setStatusText('');
      
    } catch (error) {
      console.error('Voice interaction error:', error);
      try {
        const errorMsg = await getErrorMessage('not_understood');
        await speak(errorMsg);
      } catch (speakError) {
        console.error('Failed to speak error message:', speakError);
        setStatusText('Something went wrong. Try again.');
        setTimeout(() => setStatusText(''), 3000);
      }
      setState('IDLE');
      setStatusText('');
    }
  }, [state, conversationContext, speak, transcribe, parseIntent, recordAudio, stopRecording, getGreeting, getTransition, getErrorMessage, onSearch]);

  const getButtonVariant = () => {
    switch (state) {
      case 'LISTENING':
        return 'destructive';
      case 'PROCESSING':
      case 'SEARCHING':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getButtonIcon = () => {
    switch (state) {
      case 'LISTENING':
        return <MicOff className="h-6 w-6" />;
      case 'PROCESSING':
      case 'SEARCHING':
      case 'GREETING':
      case 'CLARIFYING':
        return <Loader2 className="h-6 w-6 animate-spin" />;
      default:
        return <Mic className="h-6 w-6" />;
    }
  };

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <audio ref={audioRef} className="hidden" />
      
      <Button
        size="lg"
        variant={getButtonVariant()}
        onClick={handleMicClick}
        disabled={state !== 'IDLE' && state !== 'LISTENING'}
        className={cn(
          "rounded-full h-16 w-16 shadow-lg transition-all",
          state === 'LISTENING' && "animate-pulse ring-4 ring-red-500/50",
          state === 'IDLE' && "hover:scale-110"
        )}
        data-testid="button-voice-mic"
      >
        {getButtonIcon()}
      </Button>
      
      {statusText && (
        <div 
          className="text-sm text-muted-foreground animate-fade-in"
          data-testid="text-voice-status"
        >
          {statusText}
        </div>
      )}
      
      {state === 'IDLE' && !hasResults && (
        <div className="text-xs text-muted-foreground text-center max-w-[200px]">
          Tap to talk to Sunny
        </div>
      )}
    </div>
  );
}

export default SunnyVoice;
