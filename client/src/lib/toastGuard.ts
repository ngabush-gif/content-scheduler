/**
 * Toast Guard - Prevents duplicate toasts for the same action
 * 
 * Usage:
 *   const guard = useToastGuard();
 *   guard.loading('action-key', 'Loading message');
 *   guard.dismiss('action-key');
 *   guard.success('action-key', 'Success message');
 *   guard.error('action-key', 'Error message');
 */

import { useRef } from 'react';
import { toast } from 'sonner';

interface ToastEntry {
  id: string | number;
  type: 'loading' | 'success' | 'error' | 'info';
  timestamp: number;
}

export function useToastGuard() {
  const activeToasts = useRef<Map<string, ToastEntry>>(new Map());

  const log = (action: string, type: string, message: string) => {
    const timestamp = new Date().toISOString();
    console.log(`[Toast:${type}] ${timestamp} | Action: ${action} | Message: ${message}`);
  };

  const loading = (actionKey: string, message: string) => {
    // Dismiss any existing toast for this action
    const existing = activeToasts.current.get(actionKey);
    if (existing) {
      toast.dismiss(existing.id);
      log(actionKey, 'dismiss', `Dismissed existing ${existing.type} toast`);
    }

    const toastId = toast.loading(message);
    activeToasts.current.set(actionKey, {
      id: toastId,
      type: 'loading',
      timestamp: Date.now(),
    });
    log(actionKey, 'loading', message);
    return toastId;
  };

  const success = (actionKey: string, message: string) => {
    // Dismiss loading toast if exists
    const existing = activeToasts.current.get(actionKey);
    if (existing?.type === 'loading') {
      toast.dismiss(existing.id);
      log(actionKey, 'dismiss', `Dismissed loading toast before success`);
    }

    const toastId = toast.success(message);
    activeToasts.current.set(actionKey, {
      id: toastId,
      type: 'success',
      timestamp: Date.now(),
    });
    log(actionKey, 'success', message);
    return toastId;
  };

  const error = (actionKey: string, message: string) => {
    // Dismiss loading toast if exists
    const existing = activeToasts.current.get(actionKey);
    if (existing?.type === 'loading') {
      toast.dismiss(existing.id);
      log(actionKey, 'dismiss', `Dismissed loading toast before error`);
    }

    const toastId = toast.error(message);
    activeToasts.current.set(actionKey, {
      id: toastId,
      type: 'error',
      timestamp: Date.now(),
    });
    log(actionKey, 'error', message);
    return toastId;
  };

  const dismiss = (actionKey: string) => {
    const existing = activeToasts.current.get(actionKey);
    if (existing) {
      toast.dismiss(existing.id);
      log(actionKey, 'dismiss', `Dismissed ${existing.type} toast`);
      activeToasts.current.delete(actionKey);
    }
  };

  const dismissAll = () => {
    activeToasts.current.forEach((entry, key) => {
      toast.dismiss(entry.id);
      log(key, 'dismiss', `Dismissed ${entry.type} toast (batch)`);
    });
    activeToasts.current.clear();
  };

  return {
    loading,
    success,
    error,
    dismiss,
    dismissAll,
  };
}
