import React from 'react';
import { useUiStore, Toast as ToastTypeData } from '../../stores/uiStore';
import { X_ICON, INFO_ICON, ALERT_TRIANGLE_ICON } from '../icons';

const toastIcons = {
    success: <INFO_ICON className="w-5 h-5 text-green-400" />,
    error: <ALERT_TRIANGLE_ICON className="w-5 h-5 text-red-400" />,
    warning: <ALERT_TRIANGLE_ICON className="w-5 h-5 text-amber-400" />,
    info: <INFO_ICON className="w-5 h-5 text-sky-400" />,
};

const toastStyles = {
    success: 'bg-green-500/10 border-green-500/30 text-green-300',
    error: 'bg-red-500/10 border-red-500/30 text-red-300',
    warning: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
    info: 'bg-sky-500/10 border-sky-500/30 text-sky-300',
};

const Toast: React.FC<{ toast: ToastTypeData }> = ({ toast }) => {
    const removeToast = useUiStore(state => state.removeToast);

    return (
        <div 
            className={`w-full max-w-sm p-4 rounded-xl shadow-lg border flex items-start gap-3 animate-fade-in-right bg-slate-800 ${toastStyles[toast.type]}`}
            role="alert"
        >
            <div className="flex-shrink-0 mt-0.5">
                {toastIcons[toast.type]}
            </div>
            <div className="flex-1 text-sm text-slate-200">
                {toast.message}
            </div>
            <button
                onClick={() => removeToast(toast.id)}
                className="flex-shrink-0 -mr-1 -mt-1 p-1 rounded-full hover:bg-white/10 text-slate-400 hover:text-white"
                aria-label="Close"
            >
                <X_ICON className="w-4 h-4" />
            </button>
        </div>
    );
};

export const ToastContainer: React.FC = () => {
    const toasts = useUiStore(state => state.toasts);

    if (toasts.length === 0) {
        return null;
    }

    return (
        <div className="fixed top-6 right-6 z-[9999] space-y-3 w-full max-w-sm">
            {toasts.map(toast => (
                <Toast key={toast.id} toast={toast} />
            ))}
        </div>
    );
};