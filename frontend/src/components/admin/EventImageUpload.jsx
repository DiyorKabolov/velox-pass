import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Trash2, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import Button from '../ui/Button'

const MAX_BYTES = 5 * 1024 * 1024
const ACCEPTED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

/**
 * Drop zone for an event's artwork.
 *
 * Works before the event exists as well as after: on the create page there is
 * no id to upload against yet, so the chosen file is handed back to the parent
 * and sent once the event has been saved. `value` is the stored path for an
 * event that already has one.
 */
export default function EventImageUpload({
  value,
  file,
  onPick,
  onRemove,
  busy,
  // Named by the caller: the same drop zone takes a venue's photo as well.
  alt = 'Обложка мероприятия',
}) {
  const input = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState(null)

  // A locally chosen file is previewed from an object URL, which has to be
  // revoked or the browser holds every one of them for the session.
  useEffect(() => {
    if (!file) {
      setPreview(null)
      return undefined
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const accept = (candidate) => {
    if (!candidate) return
    if (!ACCEPTED.includes(candidate.type)) {
      toast.error('Нужен JPEG, PNG, GIF или WebP')
      return
    }
    if (candidate.size > MAX_BYTES) {
      toast.error('Изображение больше 5 МБ')
      return
    }
    onPick(candidate)
  }

  const shown = preview || value

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept={ACCEPTED.join(',')}
        className="hidden"
        onChange={(event) => {
          const chosen = event.target.files?.[0]
          // Reset first: choosing the same file twice fires no change event.
          event.target.value = ''
          accept(chosen)
        }}
      />

      {shown ? (
        <div className="space-y-2">
          <img
            src={shown}
            alt={alt}
            className="h-40 w-full rounded-[var(--radius-sm)] border border-[var(--border)] object-cover"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              <Upload size={13} />
              Изменить фото
            </Button>
            <Button size="sm" variant="danger" disabled={busy} onClick={onRemove}>
              <Trash2 size={13} />
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            accept(event.dataTransfer.files?.[0])
          }}
          className={[
            'flex h-40 w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-sm)]',
            'border border-dashed text-sm transition-colors duration-150',
            dragging
              ? 'border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--text)]'
              : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--border2)]',
          ].join(' ')}
        >
          <ImagePlus size={22} className="opacity-70" />
          Перетащите фото или нажмите
          <span className="text-xs text-[var(--muted2)]">JPEG, PNG, GIF, WebP · до 5 МБ</span>
        </button>
      )}
    </div>
  )
}
