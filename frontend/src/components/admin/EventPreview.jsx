import { CalendarDays, MapPin } from 'lucide-react'
import { formatDateTime } from '../../utils/dates'
import { withAlpha } from '../../utils/colors'

/**
 * Miniature of the real ticket card, driven straight off the form state so the
 * colour choices can be judged without saving first.
 *
 * `date` is the moment to print when the form keeps it somewhere other than
 * `form.date` -- the wizard's seated events hold it in `datetime` or in a
 * repeat rule. `notch` is the colour of whatever the preview stands on: the
 * holes punched at the perforation are painted in it.
 */
export default function EventPreview({ form, date = form.date, notch = 'var(--surface)' }) {
  const { card_bg: bg, card_accent: accent, card_text: text } = form

  return (
    // top-20 clears the 64px navbar; at top-4 the preview parked itself
    // behind the bar as soon as the form was scrolled.
    <div className="sticky top-20">
      <p className="mb-3 t-label">
        Предпросмотр
      </p>

      <div
        className="overflow-hidden rounded-[12px] shadow-[0_24px_48px_-20px_rgba(0,0,0,0.8)]"
        style={{ background: bg, color: text }}
      >
        <div className="h-1.5 w-full" style={{ background: accent }} />

        <div className="flex">
          <div className="min-w-0 flex-1 px-4 py-4">
            <p
              className="t-poster text-[12px] leading-none"
              style={{ color: accent }}
            >
              Velox/Pass
            </p>

            <h3 className="t-poster mt-2 truncate text-[22px] leading-[0.95]">
              {form.title.trim() || 'Название мероприятия'}
            </h3>

            <p className="mt-2 flex items-center gap-1.5 text-[12px] leading-none opacity-60">
              <CalendarDays size={13} strokeWidth={1.8} />
              {date ? formatDateTime(date) : 'Дата не указана'}
            </p>
            {form.location.trim() && (
              <p className="mt-1.5 flex items-center gap-1.5 truncate text-[12px] leading-none opacity-60">
                <MapPin size={13} strokeWidth={1.8} />
                <span className="truncate">{form.location}</span>
              </p>
            )}

            <span
              className="mt-3 inline-block rounded-[3px] px-2 py-[5px] font-mono2 text-[10px] leading-none"
              style={{
                background: withAlpha(accent, 0.14),
                border: `1px solid ${withAlpha(accent, 0.45)}`,
              }}
            >
              VP-PREVIEW
            </span>
          </div>

          <div
            className="relative flex w-[104px] shrink-0 flex-col items-center justify-center gap-2 px-3 py-4"
            style={{ background: accent, color: bg }}
          >
            {/* Perforation, matching the real card. */}
            <span
              aria-hidden
              className="absolute -left-[7px] -top-[7px] h-[14px] w-[14px] rounded-full"
              style={{ background: notch }}
            />
            <span
              aria-hidden
              className="absolute -bottom-[7px] -left-[7px] h-[14px] w-[14px] rounded-full"
              style={{ background: notch }}
            />

            <div className="grid h-[62px] w-[62px] place-items-center rounded-lg bg-white">
              <div
                className="h-[46px] w-[46px]"
                style={{
                  // Cheap QR stand-in: a checker pattern in the ticket's ink.
                  backgroundImage:
                    'repeating-conic-gradient(#111 0% 25%, #fff 0% 50%)',
                  backgroundSize: '11px 11px',
                }}
              />
            </div>
            <p className="text-center font-display text-[9.5px] font-bold uppercase leading-[1.1] tracking-[0.04em] opacity-90">
              Покажите
              <br />
              при входе
            </p>
          </div>
        </div>
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-[var(--muted2)]">
        Эти три цвета сохраняются в мероприятии и применяются ко всем его билетам.
      </p>
    </div>
  )
}
