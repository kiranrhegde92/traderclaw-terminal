/**
 * Global toast singleton — call from anywhere without hooks.
 *
 * Usage:
 *   import { toast } from '@/lib/toast'
 *   toast.success('Order placed!')
 *   toast.error('Connection failed')
 *   toast.warn('Market is closed')
 *   toast.info('Syncing data…')
 */
import { useToastStore, ToastType } from '@/lib/stores/useToastStore'

function add(type: ToastType, message: string) {
  useToastStore.getState().add(type, message)
}

export const toast = {
  success: (message: string) => add('success', message),
  error:   (message: string) => add('error',   message),
  warn:    (message: string) => add('warning',  message),
  info:    (message: string) => add('info',     message),
}
