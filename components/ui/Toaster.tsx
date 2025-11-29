
import React, { useState, useEffect, useCallback } from 'react';

interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error';
}

let toastId = 0;
const listeners: Array<(toast: ToastMessage) => void> = [];

export const toast = (message: string, type: 'success' | 'error' = 'success') => {
  const newToast = { id: toastId++, message, type };
  listeners.forEach((listener) => listener(newToast));
};

export const Toaster: React.FC = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const newToastListener = (newToast: ToastMessage) => {
      setToasts((currentToasts) => [...currentToasts, newToast]);
      setTimeout(() => {
        setToasts((currentToasts) =>
          currentToasts.filter((t) => t.id !== newToast.id)
        );
      }, 3000);
    };

    listeners.push(newToastListener);
    return () => {
      const index = listeners.indexOf(newToastListener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, []);

  const getBgColor = (type: 'success' | 'error') => {
    switch (type) {
      case 'success':
        return 'bg-lime/80 backdrop-blur-sm text-charcoal';
      case 'error':
        return 'bg-red-500/80 backdrop-blur-sm text-white';
    }
  };
  
  const getIcon = (type: 'success' | 'error') => {
    if (type === 'success') {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
      );
    }
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
    );
  }

  return (
    <div className="fixed bottom-0 right-0 p-4 space-y-2 z-50">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center p-4 rounded-lg shadow-lg animate-fade-in-up border border-white/10 ${getBgColor(toast.type)}`}
        >
          <div className="mr-3">{getIcon(toast.type)}</div>
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
};

// Add keyframes for animation in a style tag for simplicity as we can't edit CSS files.
const style = document.createElement('style');
style.innerHTML = `
@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.animate-fade-in-up {
  animation: fade-in-up 0.3s ease-out forwards;
}
@keyframes fade-in-scale {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
.animate-fade-in-scale {
  animation: fade-in-scale 0.5s ease-out forwards;
}
`;
document.head.appendChild(style);
