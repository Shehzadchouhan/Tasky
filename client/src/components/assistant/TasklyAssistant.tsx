import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowUp, Bot, LoaderCircle, Mic, Send, Sparkles, Trash2, X } from 'lucide-react';
import { assistantApi } from '../../api/assistant.api.ts';
import type { AssistantHistoryMessage } from '../../api/assistant.api.ts';

type ChatMessage = {
  role: 'user' | 'assistant';
  text: string;
  pendingDelete?: { taskId: string; title: string };
};

type SpeechRecognitionResultEvent = Event & {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
};

type SpeechRecognitionErrorEvent = Event & { error: string };

type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

export function TasklyAssistant() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', text: 'Hi! I can help you check, organize, and update your tasks. What would you like to do?' },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const speakReplyRef = useRef(false);
  const requestInFlightRef = useRef(false);
  const finalTranscriptRef = useRef('');

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading]);

  const speak = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  };

  const sendMessage = async (text: string) => {
    const prompt = text.trim();
    if (!prompt || requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    setInput('');
    setMessages((current) => [...current, { role: 'user', text: prompt }]);
    setIsLoading(true);
    setVoiceError('');
    try {
      const history: AssistantHistoryMessage[] = messages.slice(-12).map(({ role, text }) => ({ role, text }));
      const reply = await assistantApi.chat(prompt, history);
      setMessages((current) => [...current, {
        role: 'assistant',
        text: reply.message,
        ...(reply.pendingDelete ? { pendingDelete: reply.pendingDelete } : {}),
      }]);
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      if (speakReplyRef.current) speak(reply.message);
    } catch (error) {
      setMessages((current) => [...current, {
        role: 'assistant',
        text: error instanceof Error ? error.message : 'Sorry, I could not reach the assistant.',
      }]);
    } finally {
      speakReplyRef.current = false;
      requestInFlightRef.current = false;
      setIsLoading(false);
    }
  };

  const submitMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage(input);
  };

  const startListening = () => {
    const speechWindow = window as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceError('Voice input is not supported in this browser. Try Chrome or Edge.');
      return;
    }
    setVoiceError('');
    finalTranscriptRef.current = '';
    const recognition = new Recognition();
    recognition.lang = navigator.language || 'en-US';
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let interimTranscript = '';
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const result = event.results[index];
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) {
          finalTranscriptRef.current += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      setInput(`${finalTranscriptRef.current} ${interimTranscript}`.trim());
    };
    recognition.onerror = (event) => {
      setVoiceError(event.error === 'not-allowed'
        ? 'Microphone permission was denied.'
        : `Voice input failed: ${event.error}.`);
    };
    recognition.onend = () => {
      setIsListening(false);
      const transcript = finalTranscriptRef.current.trim();
      finalTranscriptRef.current = '';
      if (transcript) {
        speakReplyRef.current = true;
        void sendMessage(transcript);
      }
    };
    try {
      recognition.start();
      setIsListening(true);
    } catch {
      setVoiceError('Could not start voice input. Please try again.');
    }
  };

  const confirmDelete = async (pendingDelete: NonNullable<ChatMessage['pendingDelete']>) => {
    setIsLoading(true);
    try {
      const result = await assistantApi.confirmDelete(pendingDelete.taskId);
      setMessages((current) => [
        ...current.map((message) => message.pendingDelete?.taskId === pendingDelete.taskId
          ? { ...message, pendingDelete: undefined }
          : message),
        { role: 'assistant', text: result.message },
      ]);
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
    } catch (error) {
      setMessages((current) => [...current, {
        role: 'assistant',
        text: error instanceof Error ? error.message : 'Could not delete the task.',
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const cancelDelete = (taskId: string) => {
    setMessages((current) => current.map((message) => message.pendingDelete?.taskId === taskId
      ? { ...message, pendingDelete: undefined, text: `${message.text}\nDeletion cancelled.` }
      : message));
  };

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {isOpen && (
        <section
          aria-label="Taskly AI assistant"
          className="mb-3 flex h-[min(34rem,calc(100dvh-7rem))] w-[min(23rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#25253a]"
        >
          <header className="flex items-center justify-between bg-gradient-to-r from-[#6c63ff] to-[#5750d6] px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-bold">Taskly Assistant</h2>
                <p className="text-xs text-white/80">Ask by typing or voice</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close assistant"
              className="rounded-lg p-1.5 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3" aria-live="polite">
            {messages.map((message, index) => (
              <div key={`${index}-${message.role}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  message.role === 'user'
                    ? 'bg-[#6c63ff] text-white'
                    : 'bg-slate-100 text-slate-800 dark:bg-white/10 dark:text-slate-100'
                }`}>
                  <p className="whitespace-pre-wrap">{message.text}</p>
                  {message.pendingDelete && (
                    <div className="mt-3 rounded-xl border border-rose-200 bg-white p-2.5 text-slate-800 dark:border-rose-900 dark:bg-[#1e1e2f] dark:text-slate-100">
                      <p className="text-xs font-medium">Delete “{message.pendingDelete.title}”?</p>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => confirmDelete(message.pendingDelete!)}
                          disabled={isLoading}
                          className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => cancelDelete(message.pendingDelete!.taskId)}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-200"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" /> Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400" role="status">
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                Working on it…
              </div>
            )}
          </div>

          <form onSubmit={submitMessage} className="border-t border-slate-200 p-3 dark:border-white/10">
            {voiceError && <p role="alert" className="mb-2 text-xs text-rose-600 dark:text-rose-400">{voiceError}</p>}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={startListening}
                disabled={isLoading || isListening}
                aria-label={isListening ? 'Listening' : 'Start voice input'}
                className={`rounded-xl p-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6c63ff] disabled:opacity-50 ${
                  isListening ? 'bg-rose-100 text-rose-600 dark:bg-rose-950' : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'
                }`}
              >
                <Mic className="h-4 w-4" aria-hidden="true" />
              </button>
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={isListening ? 'Listening…' : 'Ask Taskly anything…'}
                aria-label="Message the Taskly assistant"
                maxLength={2000}
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#6c63ff] focus:ring-2 focus:ring-[#6c63ff]/20 dark:border-white/10 dark:bg-[#1e1e2f] dark:text-white"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                aria-label="Send message"
                className="rounded-xl bg-[#6c63ff] p-2.5 text-white hover:bg-[#5750d6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6c63ff] disabled:opacity-50"
              >
                {input.trim() ? <Send className="h-4 w-4" aria-hidden="true" /> : <ArrowUp className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
          </form>
        </section>
      )}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Open Taskly AI assistant"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#6c63ff] to-[#5750d6] text-white shadow-lg shadow-[#6c63ff]/30 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6c63ff]/30"
        >
          <Bot className="h-6 w-6" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
