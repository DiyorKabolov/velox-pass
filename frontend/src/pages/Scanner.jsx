import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, Check, X } from 'lucide-react'
import { Html5Qrcode } from 'html5-qrcode'
import { useScanTicket } from '../hooks/useScanner'
import { formatDateTime } from '../utils/dates'

const READER_ID = 'velox-qr-reader'
const COOLDOWN_MS = 3000
const RESULT_MS = 2600

/** Short haptic for accepted, a stutter for rejected. */
function buzz(ok) {
  if (typeof navigator?.vibrate !== 'function') return
  navigator.vibrate(ok ? [40] : [60, 40, 60])
}

function Brackets() {
  const corner =
    'absolute h-9 w-9 border-[var(--accent)] transition-colors duration-200'
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="relative aspect-square w-[68vw] max-w-[290px]">
        <span className={`${corner} left-0 top-0 rounded-tl-xl border-l-[3px] border-t-[3px]`} />
        <span className={`${corner} right-0 top-0 rounded-tr-xl border-r-[3px] border-t-[3px]`} />
        <span className={`${corner} bottom-0 left-0 rounded-bl-xl border-b-[3px] border-l-[3px]`} />
        <span className={`${corner} bottom-0 right-0 rounded-br-xl border-b-[3px] border-r-[3px]`} />
      </div>
    </div>
  )
}

export default function Scanner() {
  const scan = useScanTicket()

  const [running, setRunning] = useState(false)
  const [error, setError] = useState(null)
  const [count, setCount] = useState(0)
  const [result, setResult] = useState(null)
  const [flash, setFlash] = useState(false)

  const qrRef = useRef(null)
  // Guards the cooldown from inside the scanner callback, where state would
  // otherwise be captured stale.
  const lockedUntil = useRef(0)
  const resultTimer = useRef(null)

  const handleCode = useCallback(
    (text) => {
      const now = Date.now()
      if (now < lockedUntil.current) return
      lockedUntil.current = now + COOLDOWN_MS

      setFlash(true)
      setTimeout(() => setFlash(false), 160)
      setCount((n) => n + 1)

      scan.mutate(text, {
        onSuccess: (data) => {
          buzz(data.ok)
          setResult(data)
        },
        onError: (err) => {
          buzz(false)
          setResult({
            ok: false,
            status: 'error',
            message:
              err?.response?.status === 403
                ? 'Нет прав сканера'
                : 'Сервер недоступен',
          })
        },
      })

      clearTimeout(resultTimer.current)
      resultTimer.current = setTimeout(() => setResult(null), RESULT_MS)
    },
    [scan],
  )

  useEffect(() => {
    const qr = new Html5Qrcode(READER_ID, { verbose: false })
    qrRef.current = qr
    let stopped = false

    qr.start(
      { facingMode: 'environment' },
      // No qrbox on purpose. It would make html5-qrcode draw its own shaded
      // region, positioned for an unscaled video — but the feed is rendered
      // with object-cover, so that overlay never lines up with the brackets
      // below. Without it the whole frame is scanned and only our guide shows.
      { fps: 10 },
      handleCode,
      // Per-frame decode misses are normal; ignore them.
      () => {},
    )
      .then(() => !stopped && setRunning(true))
      .catch((err) => {
        setError(
          String(err).includes('NotAllowedError') || String(err).includes('Permission')
            ? 'Доступ к камере запрещён. Разрешите его в настройках браузера.'
            : 'Не удалось запустить камеру. Нужен HTTPS или localhost.',
        )
      })

    return () => {
      stopped = true
      clearTimeout(resultTimer.current)
      // stop() rejects if the camera never started; nothing to clean up then.
      qr.stop().then(() => qr.clear()).catch(() => {})
    }
    // handleCode is stable enough: the camera must not restart on each scan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const ticket = result?.ticket

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Camera feed.

          html5-qrcode writes inline styles onto the element it is handed
          (position, explicit sizes, a border), and inline styles beat classes.
          So the reader lives inside a container we control, and the sizing
          below is marked important to survive whatever the library sets. */}
      <div className="absolute inset-0 overflow-hidden bg-black">
        <div
          id={READER_ID}
          className="h-full w-full [&>div]:!h-full [&>div]:!w-full [&>div]:!border-0 [&>div]:!p-0 [&_img]:hidden [&_video]:!h-full [&_video]:!w-full [&_video]:!object-cover"
        />
      </div>

      {!error && <Brackets />}

      {/* Flash on every accepted frame */}
      {flash && <div className="pointer-events-none absolute inset-0 bg-white/70" />}

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-5">
        <span className="font-display text-sm tracking-[0.18em] text-white drop-shadow">
          VELOX<span className="text-[var(--accent)]">·</span>PASS
        </span>
        <span className="flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 backdrop-blur">
          {running ? (
            <Camera size={14} className="text-[var(--ok)]" />
          ) : (
            <CameraOff size={14} className="text-[var(--muted)]" />
          )}
          <span className="font-mono2 text-xs text-white">{count}</span>
        </span>
      </div>

      {error && (
        <div className="relative z-10 m-auto max-w-xs rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
          <CameraOff size={26} className="mx-auto mb-3 text-[var(--err)]" />
          <p className="text-sm text-[var(--text)]">{error}</p>
        </div>
      )}

      {!error && (
        <p className="relative z-10 mt-auto pb-8 text-center text-sm text-white/70 drop-shadow">
          Наведите камеру на QR-код билета
        </p>
      )}

      {/* Result overlay */}
      {result && (
        <div
          className="absolute inset-0 z-20 flex flex-col items-center justify-center px-6 text-center"
          style={{
            background: result.ok
              ? 'rgba(22, 101, 52, 0.94)'
              : 'rgba(127, 29, 29, 0.94)',
          }}
        >
          <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-white/15">
            {result.ok ? (
              <Check size={44} className="text-white" strokeWidth={3} />
            ) : (
              <X size={44} className="text-white" strokeWidth={3} />
            )}
          </div>

          <p className="font-display text-2xl text-white">
            {result.ok ? 'Проход разрешён' : 'Отказано'}
          </p>
          <p className="mt-2 max-w-xs text-sm text-white/80">{result.message}</p>

          {ticket && (
            <div className="mt-6 w-full max-w-xs rounded-[var(--radius)] bg-black/25 p-4 text-left">
              <p className="truncate text-base font-semibold text-white">
                {ticket.event_title}
              </p>
              <p className="mt-1 text-sm text-white/70">
                {formatDateTime(ticket.event_date)}
              </p>
              {ticket.seat_label && (
                <p className="mt-0.5 text-sm text-white/70">Место: {ticket.seat_label}</p>
              )}
              <p className="mt-2 font-mono2 text-xs text-white/60">{ticket.ticket_id}</p>
            </div>
          )}

          {!result.ok && result.used_at && (
            <p className="mt-4 font-mono2 text-xs text-white/70">
              Погашен: {formatDateTime(result.used_at)}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
