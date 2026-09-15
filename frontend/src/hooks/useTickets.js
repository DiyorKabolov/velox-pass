import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { apiError } from '../api/client'
import { pluralize } from '../utils/plural'
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
    onSuccess: (tickets) => {
      queryClient.invalidateQueries({ queryKey: TICKETS_KEY })
      queryClient.invalidateQueries({ queryKey: ['events'] })
      const issued = Array.isArray(tickets) ? tickets : [tickets]
      toast.success(
        issued.length === 1
          ? `Билет ${issued[0].ticket_id} ваш`
          : `${pluralize(issued.length, 'билет', 'билета', 'билетов')} ваши`,
      )
    },
    onError: (error) => toast.error(apiError(error, 'Не удалось получить билет')),
  })
}

export default useTickets
