import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ConfirmationState {
  isConfirmationOpen: boolean;
  confirmationTitle: string;
  confirmationMessage: string;
  onConfirmAction: (() => void) | null;
}

interface UiState extends ConfirmationState {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
  showConfirmation: (title: string, message: string, onConfirm: () => void) => void;
  hideConfirmation: () => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
}

const initialConfirmationState: ConfirmationState = {
  isConfirmationOpen: false,
  confirmationTitle: '',
  confirmationMessage: '',
  onConfirmAction: null,
};

export const useUiStore = create<UiState>((set, get) => ({
  // Toasts
  toasts: [],
  addToast: (message, type = 'info', duration = 5000) => {
    const id = Math.random().toString(36).substring(2, 9);
    set(state => ({
      toasts: [...state.toasts, { id, message, type }],
    }));

    if (duration > 0) {
        setTimeout(() => {
            get().removeToast(id);
        }, duration);
    }
  },
  removeToast: (id) => {
    set(state => ({
      toasts: state.toasts.filter(toast => toast.id !== id),
    }));
  },
  
  // Confirmation Modal
  ...initialConfirmationState,
  showConfirmation: (title, message, onConfirm) => {
    set({
      isConfirmationOpen: true,
      confirmationTitle: title,
      confirmationMessage: message,
      onConfirmAction: onConfirm,
    });
  },
  hideConfirmation: () => {
    set({ ...initialConfirmationState });
  },

  // Theme Management
  theme: 'dark', // Default, will be overridden on mount
  setTheme: (theme) => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    set({ theme });
  },
  toggleTheme: () => {
    const currentTheme = get().theme;
    get().setTheme(currentTheme === 'dark' ? 'light' : 'dark');
  },
}));