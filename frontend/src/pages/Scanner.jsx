import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, Check, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Html5Qrcode } from 'html5-qrcode'
import { useLocation, useNavigate } from 'react-router-dom'
import { useScanTicket } from '../hooks/useScanner'
import { formatDateTime } from '../utils/dates'
import Logo from '../components/layout/Logo'

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
async function startRearCamera(qr, config, onCode, isStale = () => false) {
  // Per-frame decode misses are normal; ignore them.
  const ignoreMisses = () => {}

  try {
    await qr.start({ facingMode: { exact: 'environment' } }, config, onCode, ignoreMisses)
    return true
  } catch (err) {
    if (isFatal(err)) throw err
  }

  // Checked between attempts, not only at the end: three getUserMedia round
  // trips take seconds, and without this the camera light comes on after the
  // operator has already left the page.
  if (isStale()) return false

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

  if (isStale()) return false

  // Nothing rear-facing on this device: run what there is and let the caller
  // warn about it, rather than showing a black screen.
  await qr.start({ facingMode: 'environment' }, config, onCode, ignoreMisses)
  return readFacingMode(qr) === 'environment'
}

/**
 * Shut the camera down without ever throwing.
 *
 * html5-qrcode's stop() throws a plain string *synchronously* when the scanner
 * is not running -- which it is not while start() is still negotiating, and
 * never is when start() failed outright. A synchronous throw is not a rejected
 * promise, so the .catch() that looked like it covered this could never run,
 * and the exception escaped the effect cleanup. React treats an error thrown
 * while unmounting as fatal and tears the whole tree down, which is the blank
 * page that appears on leaving the scanner.
 */
export function shutDownCamera(qr) {
  if (!qr) return
  try {
    const stopping = qr.stop()
    // Defensive: a future version returning nothing must not break the chain.
    if (stopping && typeof stopping.then === 'function') {
      stopping
        .then(() => {
          // The container is React's and may already be detached by now.
          try {
            qr.clear()
          } catch {
            /* nothing left to clear */
          }
        })
        .catch(() => {})
    }
  } catch {
    // Never started, so there is nothing to stop and nothing to wait for.
    try {
      qr.clear()
    } catch {
      /* nothing left to clear */
    }
  }
}

function Brackets() {
  const reduce = useReducedMotion()
  const corner = 'absolute h-10 w-10 border-[#f1ece3]'
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="relative aspect-square w-[68vw] max-w-[300px]">
        <span className={`${corner} left-0 top-0 rounded-tl-[10px] border-l-2 border-t-2`} />
        <span className={`${corner} right-0 top-0 rounded-tr-[10px] border-r-2 border-t-2`} />
        <span className={`${corner} bottom-0 left-0 rounded-bl-[10px] border-b-2 border-l-2`} />
        <span className={`${corner} bottom-0 right-0 rounded-br-[10px] border-b-2 border-r-2`} />
        {/* The one moving thing on a waiting screen: a slow sweep that says
            the camera is looking. Left out when motion is turned down. */}
        {!reduce && (
          <motion.span
            className="absolute inset-x-3 h-px bg-[var(--accent)] shadow-[0_0_12px_rgba(255,91,46,0.8)]"
            initial={{ top: '12%' }}
            animate={{ top: ['12%', '88%', '12%'] }}
            transition={{ duration: 3.2, ease: 'easeInOut', repeat: Infinity }}
          />
        )}
      </div>
    </div>
  )
}

export default function Scanner() {
  const scan = useScanTicket()
  const navigate = useNavigate()
  const location = useLocation()

  // Back to wherever the scanner was opened from; opened straight from a link
  // or a home-screen icon there is nothing behind it, so to the start.
  const leave = () => {
    if (location.key === 'default') navigate('/', { replace: true })
    else navigate(-1)
  }

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
      () => stopped,
    )
      .then((rear) => {
        // Leaving the page can beat the camera coming up, since there are up to
        // three attempts to get through; the light must not stay on.
        if (stopped) {
          shutDownCamera(qr)
          return
        }
        setRunning(true)
        // Anything not confirmed rear-facing is treated as a front camera: it
        // is the one that gets the mirrored preview, and the one whose frames
        // may arrive mirrored too, which no amount of display work can fix.
        setFrontCamera(!rear)
      })
      .catch((err) => {
        // Nothing to report to a page that is no longer on screen.
        if (stopped) return
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
      shutDownCamera(qr)
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
      <div className="relative z-10 flex items-center justify-between gap-4 bg-gradient-to-b from-black/70 to-transparent px-5 pb-10 pt-5">
        <Logo className="text-[22px] text-[#f1ece3]" />
        <div className="flex items-center gap-5">
          <span
            title={`Отсканировано: ${count}`}
            className="flex items-center gap-2.5 text-[13px] text-white/75"
          >
            {running ? (
              <Camera size={15} strokeWidth={1.75} className="text-[var(--ok)]" />
            ) : (
              <CameraOff size={15} strokeWidth={1.75} className="text-white/50" />
            )}
            <span className="hidden sm:inline">Отсканировано</span>
            <span className="t-poster t-num text-[24px] leading-none text-white">{count}</span>
          </span>
          {/* The scanner covers the whole screen, navigation included, and an
              installed app on a phone may have no back button of its own. */}
          <button
            type="button"
            onClick={leave}
            aria-label="Закрыть сканер"
            className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition-[background-color,transform] duration-200 hover:bg-white/20 active:scale-[0.94]"
          >
            <X size={20} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {error && (
        <div className="relative z-10 m-auto max-w-xs rounded-[var(--radius)] border border-[var(--border2)] bg-[var(--surface)] p-7">
          <CameraOff size={24} strokeWidth={1.5} className="text-[var(--err)]" />
          <p className="mt-4 font-display text-[22px] font-bold uppercase leading-none text-[var(--text)]">
            Камера недоступна
          </p>
          <p className="mt-3 text-[14px] leading-relaxed text-[var(--muted)]">{error}</p>
        </div>
      )}

      {!error && (
        <div className="relative z-10 mt-auto bg-gradient-to-t from-black/70 to-transparent px-6 pb-10 pt-16 text-center">
          {frontCamera ? (
            <p className="mx-auto max-w-xs rounded-[var(--radius-sm)] bg-black/70 px-4 py-3 text-[14px] leading-relaxed text-white/85">
              Задняя камера недоступна. Фронтальная часто отдаёт зеркальный кадр —
              такой QR-код не читается. Откройте сканер на телефоне.
            </p>
          ) : (
            <p className="text-[15px] text-white/75">Наведите камеру на QR-код билета</p>
          )}
        </div>
      )}

      {/* Result overlay: the verdict fills the screen, readable at arm's length. */}
      <AnimatePresence>
        {result && (
          <motion.div
            key={result.ticket?.ticket_id ?? result.message}
            initial={{ opacity: 0, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1, transition: { duration: 0.16 } }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center px-6 text-center"
            style={{
              background: result.ok ? 'rgba(14, 82, 44, 0.96)' : 'rgba(118, 20, 28, 0.96)',
            }}
          >
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border-2 border-white/80">
              {result.ok ? (
                <Check size={40} className="text-white" strokeWidth={2.5} />
              ) : (
                <X size={40} className="text-white" strokeWidth={2.5} />
              )}
            </div>

            <p className="t-poster text-[clamp(48px,14vw,96px)] text-white">
              {result.ok ? 'Билет действителен' : 'Отказано'}
            </p>
            <p className="mt-4 max-w-xs text-[15px] text-white/85">{result.message}</p>

            {ticket && (
              <div className="mt-8 w-full max-w-xs border-t border-dashed border-white/40 pt-5 text-left">
                <p className="truncate font-display text-[22px] font-bold uppercase leading-tight text-white">
                  {ticket.event_title}
                </p>
                <p className="t-num mt-1.5 text-[14px] text-white/75">
                  {formatDateTime(ticket.event_date)}
                </p>
                {ticket.seat_label && (
                  <p className="mt-0.5 text-[14px] text-white/75">Место: {ticket.seat_label}</p>
                )}
                <p className="mt-3 font-mono2 text-[11px] text-white/60">{ticket.ticket_id}</p>
              </div>
            )}

            {!result.ok && result.used_at && (
              <p className="t-num mt-5 font-mono2 text-[11px] text-white/70">
                Погашен: {formatDateTime(result.used_at)}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
