import { useMutation } from '@tanstack/react-query'
import { checkTicket } from '../api/scanner'

/**
 * Sends one scanned code to the backend. Errors are surfaced through the
 * mutation rather than thrown, so the scanner UI can show a red overlay for
 * both a rejected ticket and a network failure.
 */
export function useScanTicket() {
  return useMutation({
    mutationFn: checkTicket,
  })
}

export default useScanTicket
