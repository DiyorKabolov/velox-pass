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
 * The map comes over HTTP; the socket only carries deltas, so a dropped
 * connection degrades to stale data rather than an empty screen. It
 * reconnects on its own after RETRY_MS -- and every time it (re)connects the
 * map is fetched again, because whatever sold while it was down was announced
 * to nobody. So is it when the tab comes back into view: a phone that slept
 * with the picker open has missed everything, including seats given back.
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
  // Only the latest request may write the map: an older one landing last
  // would put back seats sold in between.
  const generation = useRef(0)
  // Seats announced as taken while a request was in flight. Its snapshot may
  // predate them, so they are taken again once it lands.
  const takenMeanwhile = useRef(new Set())

  const refetch = useCallback(async () => {
    if (!sessionId) return
    const mine = ++generation.current
    takenMeanwhile.current = new Set()
    try {
      const next = await getSessionSeats(sessionId)
      if (mine !== generation.current) return
      const taken = takenMeanwhile.current
      setMap(
        taken.size
          ? {
              ...next,
              seats: next.seats.map((seat) => (taken.has(seat.id) ? { ...seat, is_taken: true } : seat)),
            }
          : next,
      )
      setError(null)
    } catch {
      if (mine === generation.current) setError('Не удалось загрузить схему зала')
    } finally {
      if (mine === generation.current) setLoading(false)
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

      socket.onopen = () => {
        setConnected(true)
        // Including the first time: a seat sold between the map's request
        // and this moment was announced before anyone here was listening.
        refetch()
      }

      socket.onmessage = (event) => {
        let payload
        try {
          payload = JSON.parse(event.data)
        } catch {
          return
        }

        if (payload.type === 'seat_taken') {
          takenMeanwhile.current.add(payload.seat_id)
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

    const onVisible = () => {
      if (document.visibilityState === 'visible') refetch()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      closedByUs.current = true
      clearTimeout(retryRef.current)
      document.removeEventListener('visibilitychange', onVisible)
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
