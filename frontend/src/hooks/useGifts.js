import { useQuery } from '@tanstack/react-query'
import { getReceivedGifts } from '../api/gifts'
import useAuth from './useAuth'

export const GIFTS_KEY = ['gifts', 'received']

/** Tickets other people have given to the signed-in user. */
export function useGifts() {
  const { isAuthenticated } = useAuth()

  return useQuery({
    queryKey: GIFTS_KEY,
    queryFn: getReceivedGifts,
    enabled: isAuthenticated,
    staleTime: 30_000,
  })
}

export default useGifts
