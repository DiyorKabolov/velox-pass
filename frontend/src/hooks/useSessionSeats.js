import { useCallback, useEffect, useRef, useState } from 'react'
import { getSessionSeats } from '../api/sessions'

const RETRY_MS = 3000

/** ws:// or wss:// on the same origin the page was served from. */
function socketUrl(sessionId) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/ws/sessions/${sessionId}/seats`
}

/**
 * Seat map for one session, kept current by a WebSocket.
 *
 * The initial map comes over HTTP; the socket only carries deltas, so a
 * dropped connection degrades to stale data rather than an empty screen. It
 * reconnects on its own after RETRY_MS.
 */
export function useSessionSeats(sessionId) {
  const [map, setMap] = useState(null)
  const [isLoading, setLoading] = useState(Boolean(sessionId))
  const [isConnected, setConnected] = useState(false)
  const [error, setError] = useState(null)
  const [cancelled, setCancelled] = useState(false)

  const socketRef = useRef(null)
  const retryRef = useRef(null)
  const closedByUs = useRef(false)

  const refetch = useCallback(async () => {
    if (!sessionId) return
    try {
      setMap(await getSessionSeats(sessionId))
      setError(null)
    } catch {
      setError('Не удалось загрузить схему зала')
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    if (!sessionId) {
      setMap(null)
      setLoading(false)
      return undefined
    }

    closedByUs.current = false
    setLoading(true)
    setCancelled(false)
    refetch()

    const open = () => {
      if (closedByUs.current) return
      let socket
      try {
        socket = new WebSocket(socketUrl(sessionId))
      } catch {
        retryRef.current = setTimeout(open, RETRY_MS)
        return
      }
      socketRef.current = socket

      socket.onopen = () => setConnected(true)

      socket.onmessage = (event) => {
        let payload
        try {
          payload = JSON.parse(event.data)
        } catch {
          return
        }

        if (payload.type === 'seat_taken') {
          setMap((current) =>
            current
              ? {
                  ...current,
                  seats: current.seats.map((seat) =>
                    seat.id === payload.seat_id ? { ...seat, is_taken: true } : seat,
                  ),
                }
              : current,
          )
        } else if (payload.type === 'session_cancelled') {
          setCancelled(true)
        }
      }

      socket.onclose = () => {
        setConnected(false)
        if (!closedByUs.current) {
          // Live updates are a bonus, so a failed socket just retries quietly.
          retryRef.current = setTimeout(open, RETRY_MS)
        }
      }

      socket.onerror = () => socket.close()
    }

    open()

    return () => {
      closedByUs.current = true
      clearTimeout(retryRef.current)
      socketRef.current?.close()
      socketRef.current = null
      setConnected(false)
    }
  }, [sessionId, refetch])

  return {
    map,
    seats: map?.seats ?? [],
    isLoading,
    isConnected,
    isCancelled: cancelled,
    error,
    refetch,
  }
}

export default useSessionSeats
