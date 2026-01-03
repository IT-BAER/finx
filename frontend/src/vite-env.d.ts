/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DISABLE_REGISTRATION: string;
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Extend Window interface for global utilities
interface Window {
  toastWithHaptic: {
    success: (message: string, options?: object) => string;
    error: (message: string, options?: object) => string;
    info: (message: string, options?: object) => string;
    loading: (message: string, options?: object) => string;
    promise: <T>(promise: Promise<T>, options: object) => Promise<T>;
    dismiss: (toastId?: string) => void;
    remove: (toastId?: string) => void;
  };
}
