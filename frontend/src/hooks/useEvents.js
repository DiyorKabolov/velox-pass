import { useQuery } from '@tanstack/react-query'
import { getEvent, getEvents } from '../api/events'

export function useEvents(options = {}) {
  return useQuery({
    queryKey: ['events', options],
    queryFn: () => getEvents(options),
    staleTime: 60_000,
  })
}

export function useEvent(id) {
  return useQuery({
    queryKey: ['events', 'detail', id],
    queryFn: () => getEvent(id),
    enabled: Boolean(id),
  })
}
