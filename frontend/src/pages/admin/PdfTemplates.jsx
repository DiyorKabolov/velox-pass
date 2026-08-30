import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, QrCode, Star, Trash2, Type, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { apiError } from '../../api/client'
import {
  deleteTemplate,
  getPreviewImage,
  getTemplates,
  updateTemplate,
  uploadTemplate,
} from '../../api/pdfTemplates'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'
import TemplateCanvas from '../../components/admin/TemplateCanvas'
import {
  ADDABLE,
  elementLabel,
  EMPTY_LAYOUT,
  makeElement,
  parseLayout,
  serializeLayout,
} from '../../utils/pdfLayout'
import AdminLayout from './AdminLayout'

const KEY = ['admin', 'pdf-templates']

/** Number field narrow enough for four of them to share a row. */
function Num({ label, value, onChange, min = 0, step = 1 }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-[var(--muted2)]">
        {label}
      </span>
      <input
        type="number"
        min={min}
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface2)] px-2 py-1.5 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]"
      />
    </label>
  )
}

function ElementRow({ element, index, selected, onSelect, onPatch, onRemove }) {
  const isQr = element.type === 'qr'
  return (
    <div
      onClick={() => onSelect(index)}
      className={[
        'cursor-pointer rounded-[var(--radius-sm)] border p-3 transition-colors duration-150',
        selected
          ? 'border-[#3b82f6] bg-[var(--surface2)]'
          : 'border-[var(--border)] hover:border-[var(--border2)]',
      ].join(' ')}
    >
      <div className="mb-2 flex items-center gap-2">
        {isQr ? (
          <QrCode size={14} className="shrink-0 text-[var(--accent)]" />
        ) : (
          <Type size={14} className="shrink-0 text-[var(--accent)]" />
        )}
        <span className="min-w-0 flex-1 truncate text-sm">{elementLabel(element)}</span>
        <button
          type="button"
          aria-label={`Удалить ${elementLabel(element)}`}
          onClick={(event) => {
            event.stopPropagation()
            onRemove(index)
          }}
          className="shrink-0 rounded p-1 text-[var(--muted)] transition-colors hover:text-[var(--err)]"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <Num label="X" value={element.x} onChange={(x) => onPatch(index, { x })} />
        <Num label="Y" value={element.y} onChange={(y) => onPatch(index, { y })} />
        {isQr ? (
          <>
            <Num
              label="Ширина"
              value={element.width}
              min={10}
              onChange={(width) => onPatch(index, { width, height: width })}
            />
            <Num
              label="Высота"
              value={element.height}
              min={10}
              onChange={(height) => onPatch(index, { height })}
            />
          </>
        ) : (
          <>
            <Num
              label="Кегль"
              value={element.font_size}
              min={4}
              onChange={(font_size) => onPatch(index, { font_size })}
            />
            <label className="block min-w-0">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-[var(--muted2)]">
                Цвет
              </span>
              <input
                type="color"
                value={element.color || '#000000'}
                onChange={(event) => onPatch(index, { color: event.target.value })}
                className="h-[30px] w-full cursor-pointer rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface2)] p-0.5"
              />
            </label>
          </>
        )}
      </div>

      {!isQr && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onPatch(index, {
              font_weight: element.font_weight === 'bold' ? 'normal' : 'bold',
            })
          }}
          className={[
            'mt-2 rounded-[var(--radius-sm)] border px-2.5 py-1 text-[11px] transition-colors',
            element.font_weight === 'bold'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-[var(--border)] text-[var(--muted)]',
          ].join(' ')}
        >
          Полужирный
        </button>
      )}
    </div>
  )
}

export default function PdfTemplates() {
  const queryClient = useQueryClient()
  const fileInput = useRef(null)

  const [activeId, setActiveId] = useState(null)
  const [layout, setLayout] = useState({ ...EMPTY_LAYOUT, elements: [] })
  const [selected, setSelected] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [preview, setPreview] = useState(null)
  const [adding, setAdding] = useState('')

  const { data: templates, isLoading } = useQuery({ queryKey: KEY, queryFn: getTemplates })
  const active = templates?.find((item) => item.id === activeId) ?? null

  // Pick something as soon as the list arrives, so the canvas is never blank
  // for no reason.
  useEffect(() => {
    if (!activeId && templates?.length) setActiveId(templates[0].id)
  }, [templates, activeId])

  // Load the chosen template's saved layout, dropping any unsaved edits with it.
  useEffect(() => {
    if (!active) return
    setLayout(parseLayout(active.layout_json))
    setSelected(null)
    setDirty(false)
  }, [activeId]) // eslint-disable-line react-hooks/exhaustive-deps

  // The page image is behind the admin token, so it arrives as a blob URL that
  // has to be revoked or the browser holds every one of them for the session.
  useEffect(() => {
    if (!activeId) {
      setPreview(null)
      return undefined
    }
    let url = null
    let cancelled = false
    setPreview(null)
    getPreviewImage(activeId)
      .then((objectUrl) => {
        if (cancelled) {
          URL.revokeObjectURL(objectUrl)
          return
        }
        url = objectUrl
        setPreview(objectUrl)
      })
      .catch(() => toast.error('Не удалось отрисовать страницу шаблона'))
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [activeId])

  const upload = useMutation({
    mutationFn: ({ file, name }) => uploadTemplate(file, name),
    onSuccess: (template) => {
      queryClient.invalidateQueries({ queryKey: KEY })
      setActiveId(template.id)
      toast.success(`Шаблон «${template.name}» загружен`)
    },
    onError: (error) => toast.error(apiError(error, 'Не удалось загрузить шаблон')),
  })

  const save = useMutation({
    mutationFn: (payload) => updateTemplate(activeId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY })
      setDirty(false)
      toast.success('Сохранено')
    },
    onError: (error) => toast.error(apiError(error, 'Не удалось сохранить')),
  })

  const remove = useMutation({
    mutationFn: deleteTemplate,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: KEY })
      if (id === activeId) setActiveId(null)
      toast.success('Шаблон удалён')
    },
    onError: (error) => toast.error(apiError(error, 'Не удалось удалить')),
  })

  const patchElement = (index, patch) => {
    setLayout((current) => ({
      ...current,
      elements: current.elements.map((element, i) =>
        i === index ? { ...element, ...patch } : element,
      ),
    }))
    setDirty(true)
  }

  const addElement = (kind) => {
    if (!kind) return
    setLayout((current) => ({
      ...current,
      elements: [...current.elements, makeElement(kind, current.elements.length)],
    }))
    setSelected(layout.elements.length)
    setDirty(true)
    setAdding('')
  }

  const removeElement = (index) => {
    setLayout((current) => ({
      ...current,
      elements: current.elements.filter((_, i) => i !== index),
    }))
    setSelected(null)
    setDirty(true)
  }

  const onFile = (event) => {
    const file = event.target.files?.[0]
    // Reset first: picking the same file twice fires no change event otherwise.
    event.target.value = ''
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Нужен файл PDF')
      return
    }
    const name = window.prompt('Название шаблона', file.name.replace(/\.pdf$/i, ''))
    if (name === null) return
    if (!name.trim()) {
      toast.error('Укажите название')
      return
    }
    upload.mutate({ file, name: name.trim() })
  }

  return (
    <AdminLayout
      title="Шаблоны PDF"
      subtitle="Загрузите бланк и разместите на нём QR-код и поля билета."
      action={
        <>
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf,.pdf"
            onChange={onFile}
            className="hidden"
          />
          <Button loading={upload.isPending} onClick={() => fileInput.current?.click()}>
            <Upload size={15} />
            Загрузить шаблон
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Left: the list and every control. */}
        <div className="w-full shrink-0 space-y-6 lg:w-[400px]">
          <section>
            <p className="mb-2 font-mono2 text-[10px] uppercase tracking-[0.16em] text-[var(--muted2)]">
              Шаблоны
            </p>
            {isLoading ? (
              <div className="h-24 animate-pulse rounded-[var(--radius)] bg-[var(--surface)]" />
            ) : templates?.length ? (
              <div className="space-y-2">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => setActiveId(template.id)}
                    className={[
                      'flex cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] border p-3 transition-colors duration-150',
                      template.id === activeId
                        ? 'border-[var(--accent)] bg-[var(--surface2)]'
                        : 'border-[var(--border)] hover:border-[var(--border2)]',
                    ].join(' ')}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-sm">
                        {template.name}
                        {template.is_default && (
                          <span className="shrink-0 rounded-full border border-[var(--accent)] px-2 py-0.5 text-[10px] text-[var(--accent)]">
                            По умолчанию
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 font-mono2 text-[10px] text-[var(--muted2)]">
                        элементов: {template.element_count}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="danger"
                      aria-label={`Удалить ${template.name}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        if (window.confirm(`Удалить шаблон «${template.name}»?`)) {
                          remove.mutate(template.id)
                        }
                      }}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">
                Шаблонов нет. Билеты печатаются на встроенном бланке.
              </p>
            )}
          </section>

          {active && (
            <section>
              <p className="mb-2 font-mono2 text-[10px] uppercase tracking-[0.16em] text-[var(--muted2)]">
                Настройки элементов
              </p>

              <div className="mb-3 space-y-2">
                {layout.elements.map((element, index) => (
                  <ElementRow
                    key={index}
                    element={element}
                    index={index}
                    selected={index === selected}
                    onSelect={setSelected}
                    onPatch={patchElement}
                    onRemove={removeElement}
                  />
                ))}
                {layout.elements.length === 0 && (
                  <p className="text-sm text-[var(--muted)]">
                    Пока пусто. Добавьте элементы — они появятся на странице справа.
                  </p>
                )}
              </div>

              <div className="mb-4 flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <Select
                    value={adding}
                    onChange={addElement}
                    options={ADDABLE}
                    placeholder="Добавить элемент"
                    aria-label="Добавить элемент"
                  />
                </div>
                <Plus size={16} className="shrink-0 text-[var(--muted2)]" />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  disabled={active.is_default}
                  loading={save.isPending}
                  onClick={() => save.mutate({ is_default: true })}
                >
                  <Star size={14} />
                  {active.is_default ? 'Уже по умолчанию' : 'Сделать основным'}
                </Button>
                <Button
                  disabled={!dirty}
                  loading={save.isPending}
                  onClick={() => save.mutate({ layout_json: serializeLayout(layout) })}
                >
                  {dirty ? 'Сохранить' : 'Сохранено'}
                </Button>
              </div>
            </section>
          )}
        </div>

        {/* Right: the page itself. */}
        <div className="min-w-0 flex-1">
          {active ? (
            <>
              <TemplateCanvas
                imageUrl={preview}
                layout={layout}
                selected={selected}
                onSelect={setSelected}
                onMove={(index, position) => patchElement(index, position)}
              />
              <p className="mt-3 text-center text-xs text-[var(--muted2)]">
                Перетащите элемент по странице. Координаты в пунктах PDF, начало —
                левый нижний угол.
              </p>
            </>
          ) : (
            <div className="grid h-64 place-items-center rounded-[var(--radius)] border border-dashed border-[var(--border)] text-sm text-[var(--muted)]">
              Выберите или загрузите шаблон
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
