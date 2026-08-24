import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { apiError } from '../api/client'
import { buyTicket, getMyTickets } from '../api/tickets'
import useAuth from './useAuth'

export const TICKETS_KEY = ['tickets', 'my']

export function useTickets() {
  const { isAuthenticated } = useAuth()

  return useQuery({
    queryKey: TICKETS_KEY,
    queryFn: getMyTickets,
    enabled: isAuthenticated,
    staleTime: 30_000,
  })
}

export function useBuyTicket() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: buyTicket,
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({ queryKey: TICKETS_KEY })
      queryClient.invalidateQueries({ queryKey: ['events'] })
      toast.success(`Ticket ${ticket.ticket_id} is yours`)
    },
    onError: (error) => toast.error(apiError(error, 'Could not buy the ticket')),
  })
}

export default useTickets
