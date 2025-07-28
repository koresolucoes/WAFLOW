import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface UiState {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
}

export const useUiStore = create<UiState>((set, get) => ({
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
}));