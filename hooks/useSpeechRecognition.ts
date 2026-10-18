import { useCallback, useEffect, useRef, useState } from "react";

const getSpeechRecognition = () =>
  typeof window === "undefined"
    ? undefined
    : (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

export const useSpeechRecognition = (
  onResult: (transcript: string) => void,
) => {
  const [isListening, setIsListening] = useState(false);
  const [isAvailable] = useState(() => !!getSpeechRecognition());
  const recognitionRef = useRef<any>(null);
  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  const stopListening = useCallback(() => {
    const recognition = recognitionRef.current;
    // Invalidate first: abort can deliver queued result/end events synchronously.
    recognitionRef.current = null;
    setIsListening(false);
    if (recognition) {
      recognition.onresult = recognition.onerror = recognition.onend = null;
      try {
        recognition.abort();
      } catch {
        /* The browser may already have ended it. */
      }
    }
  }, []);

  useEffect(() => stopListening, [stopListening]);

  const startListening = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition || recognitionRef.current) return;
    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = "en-US";
      let nextResult = 0;
      recognition.onresult = (event: any) => {
        if (recognitionRef.current !== recognition) return;
        const transcript: string[] = [];
        for (
          let i = Math.max(nextResult, event.resultIndex);
          i < event.results.length;
          i++
        ) {
          if (event.results[i].isFinal) {
            transcript.push(event.results[i][0].transcript);
            nextResult = i + 1;
          }
        }
        const text = transcript.join(" ").trim();
        if (text) onResultRef.current(text);
      };
      recognition.onerror = (event: any) => {
        if (recognitionRef.current !== recognition) return;
        console.error("Speech recognition error", event.error);
        stopListening();
      };
      recognition.onend = () => {
        if (recognitionRef.current !== recognition) return;
        recognitionRef.current = null;
        setIsListening(false);
      };
      recognition.start();
      setIsListening(true);
    } catch (error) {
      stopListening();
      console.error("Speech recognition couldn't be started.", error);
    }
  }, [stopListening]);

  const toggleListening = () => {
    if (recognitionRef.current) stopListening();
    else startListening();
  };
  return { isListening, isAvailable, toggleListening, stopListening };
};
