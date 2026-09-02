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

// A camera pointing away from the operator. Browsers localise these labels,
// so the Russian wordings are listed alongside the English ones.
const REAR_LABEL = /back|rear|environment|задн|основ|тыл/i

/** The active camera's facing mode, or null where the browser will not say. */
function readFacingMode(qr) {
  try {
    return qr.getRunningTrackSettings()?.facingMode ?? null
  } catch {
    // The track went away between starting and asking.
    return null
  }
}

/** Errors no amount of retrying with another camera will get past. */
const isFatal = (err) =>
  /NotAllowed|Permission|NotFound|Security|Denied/i.test(String(err?.name || err || ''))

/**
 * Start a camera that faces away from the operator.
 *
 * `{ facingMode: 'environment' }` on its own is only a preference: a browser
 * that cannot honour it hands back the front camera and says nothing. That is
 * what makes a scan come out mirrored -- several platforms deliver front-camera
 * frames already flipped, and the flip is in the pixels the decoder reads, not
 * merely in how they are displayed, so a mirrored QR code fails its checksum
 * and never scans. Asking `exact` makes the request fail instead of silently
 * substituting, which is what lets the fallbacks below run deliberately.
 *
 * Resolves to whether the camera it settled on really does face away. That is
 * not the same question as `facingMode === 'user'`: a plain desktop webcam
 * usually reports no facing mode at all, so only the two branches that pick a
 * rear camera on purpose can answer it with confidence.
 */
async function startRearCamera(qr, config, onCode) {
  // Per-frame decode misses are normal; ignore them.
  const ignoreMisses = () => {}

  try {
    await qr.start({ facingMode: { exact: 'environment' } }, config, onCode, ignoreMisses)
    return true
  } catch (err) {
    if (isFatal(err)) throw err
  }

  // Some browsers refuse the exact constraint yet still list the camera, so
  // take it by id instead. Labels are readable once permission has been given,
  // which the attempt above has just obtained.
  try {
    const cameras = await Html5Qrcode.getCameras()
    const rear = cameras.find((camera) => REAR_LABEL.test(camera.label || ''))
    if (rear) {
      await qr.start(rear.id, config, onCode, ignoreMisses)
      return true
    }
  } catch (err) {
    if (isFatal(err)) throw err
  }

  // Nothing rear-facing on this device: run what there is and let the caller
  // warn about it, rather than showing a black screen.
  await qr.start({ facingMode: 'environment' }, config, onCode, ignoreMisses)
  return readFacingMode(qr) === 'environment'
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
  const [frontCamera, setFrontCamera] = useState(false)

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

    startRearCamera(
      qr,
      // No qrbox on purpose. It would make html5-qrcode draw its own shaded
      // region, positioned for an unscaled video, but the feed is rendered with
      // object-cover, so that overlay never lines up with the brackets below.
      // Without it the whole frame is scanned and only our guide shows.
      { fps: 10 },
      handleCode,
    )
      .then((rear) => {
        // Leaving the page can now beat the camera coming up, since there are
        // up to three attempts to get through; the light must not stay on.
        if (stopped) {
          qr.stop().catch(() => {})
          return
        }
        setRunning(true)
        // Anything not confirmed rear-facing is treated as a front camera: it
        // is the one that gets the mirrored preview, and the one whose frames
        // may arrive mirrored too, which no amount of display work can fix.
        setFrontCamera(!rear)
      })
      .catch((err) => {
        const text = String(err?.name || err || '')
        setError(
          /NotAllowed|Permission|Denied/i.test(text)
            ? 'Доступ к камере запрещён. Разрешите его в настройках браузера.'
            : /NotFound|Overconstrained/i.test(text)
              ? 'Камера не найдена.'
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
          className={[
            'h-full w-full [&>div]:!h-full [&>div]:!w-full [&>div]:!border-0 [&>div]:!p-0',
            '[&_img]:hidden [&_video]:!h-full [&_video]:!w-full [&_video]:!object-cover',
            // Mirrored, so aiming at a front camera works the way a mirror
            // does rather than in reverse. Display only: the decoder reads the
            // video through a canvas, which CSS never touches, so this changes
            // how the feed looks and nothing about what is scanned.
            frontCamera ? '[&_video]:![transform:scaleX(-1)]' : '',
          ].join(' ')}
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
        <span
          title={`Отсканировано: ${count}`}
          className="flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 backdrop-blur"
        >
          {running ? (
            <Camera size={14} className="text-[var(--ok)]" />
          ) : (
            <CameraOff size={14} className="text-[var(--muted)]" />
          )}
          <span className="text-xs text-white/70">Отсканировано</span>
          <span className="font-mono2 text-xs font-semibold text-white">{count}</span>
        </span>
      </div>

      {error && (
        <div className="relative z-10 m-auto max-w-xs rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
          <CameraOff size={26} className="mx-auto mb-3 text-[var(--err)]" />
          <p className="text-sm text-[var(--text)]">{error}</p>
        </div>
      )}

      {!error && (
        <div className="relative z-10 mt-auto px-6 pb-8 text-center">
          {frontCamera ? (
            <p className="mx-auto max-w-xs rounded-[var(--radius-sm)] bg-black/60 px-4 py-3 text-sm text-white/85 backdrop-blur">
              Задняя камера недоступна. Фронтальная часто отдаёт зеркальный кадр —
              такой QR-код не читается. Откройте сканер на телефоне.
            </p>
          ) : (
            <p className="text-sm text-white/70 drop-shadow">
              Наведите камеру на QR-код билета
            </p>
          )}
        </div>
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
            {result.ok ? 'Билет действителен' : 'Отказано'}
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
