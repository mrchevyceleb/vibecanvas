
import { useState, useEffect, useRef } from 'react';

// Polyfill for browsers that support it under a prefix
const SpeechRecognition =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export const useSpeechRecognition = (onResult: (transcript: string) => void) => {
  const [isListening, setIsListening] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!SpeechRecognition) {
      setIsAvailable(false);
      return;
    }
    setIsAvailable(true);

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      
      if(finalTranscript) {
          onResult(finalTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
    };
    
    recognition.onend = () => {
        if(isListening){
             recognition.start(); // a hack to keep it running
        }
    }

    recognitionRef.current = recognition;
  }, [onResult, isListening]);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (error) {
        console.error("Speech recognition couldn't be started.", error);
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return { isListening, isAvailable, toggleListening };
};
