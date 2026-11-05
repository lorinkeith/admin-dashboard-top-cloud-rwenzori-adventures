import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { FiX } from 'react-icons/fi'
import { heroPositions, type HeroSlide } from '../../types/heroSlider'
import { uploadHeroImage, markHeroImageUnused } from '../../services/heroSliderService'
import { validateHeroSlide } from '../../utils/heroSlider'
import { HeroSlidePreview } from './HeroSlidePreview'
import { heroPreviewImage } from '../../utils/heroPreviewImage'

const inputClass = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100'

export function HeroSlideForm({ initial, isNew, onSave, onClose }: { initial: HeroSlide; isNew: boolean; onSave: (slide: HeroSlide) => Promise<void>; onClose: () => void }) {
  const [slide, setSlide] = useState(initial)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => { dialog.current?.showModal() }, [])
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  const update = <K extends keyof HeroSlide>(key: K, value: HeroSlide[K]) => setSlide(current => ({ ...current, [key]: value }))
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const message = validateHeroSlide({ ...slide, image_url: file ? '/pending-upload' : slide.image_url })
    if (message) { setError(message); return }
    setError(''); setBusy(true)
    let uploadedUrl = ''
    try {
      if (file) {
        setUploading(true)
        uploadedUrl = await uploadHeroImage(file)
        setUploading(false)
      }
      const next = { ...slide, image_url: uploadedUrl || slide.image_url, title: slide.title.trim(), button_text: slide.button_text.trim(), button_url: slide.button_url.trim() }
      await onSave(next)
      onClose()
    } catch (saveError) {
      if (uploadedUrl) {
        // Reuse an upload when retrying a failed draft save.
        setSlide(current => ({ ...current, image_url: uploadedUrl })); setFile(null); setPreviewUrl('')
        markHeroImageUnused(uploadedUrl)
      }
      setError(saveError instanceof Error ? saveError.message : 'Unable to save this slide. Please try again.')
    } finally { setBusy(false); setUploading(false) }
  }

  return createPortal(
    <dialog ref={dialog} className="fixed inset-0 m-auto max-h-[92dvh] w-[calc(100%_-_1.5rem)] max-w-4xl overflow-y-auto rounded-2xl border-0 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/60" aria-labelledby="hero-slide-form-title" onCancel={event => { if (busy) event.preventDefault(); else onClose() }}>
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <h2 id="hero-slide-form-title" className="text-xl font-bold">{isNew ? 'Add new hero slide' : 'Edit hero slide'}</h2>
        <button type="button" disabled={busy} onClick={onClose} aria-label="Close slide editor" className="rounded-lg p-3 hover:bg-slate-100"><FiX /></button>
      </div>
      <form onSubmit={event => void submit(event)} className="p-5">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div>
              <p className="text-sm font-bold">Background image *</p>
              {(previewUrl || slide.image_url) && <img src={previewUrl || heroPreviewImage(slide.image_url)} alt="Selected hero background" className="mt-2 h-32 w-full rounded-xl object-cover" />}
              <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="mt-3 block w-full text-sm" disabled={busy} aria-label="Upload or replace hero image" onChange={event => {
                const selected = event.target.files?.[0]
                event.target.value = ''
                if (!selected) return
                if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type) || selected.size > 5 * 1024 * 1024 || selected.size === 0) { setError('Choose a JPG, PNG, or WebP image smaller than 5 MB.'); return }
                setError(''); setFile(selected); setPreviewUrl(URL.createObjectURL(selected))
              }} />
              <p className="mt-2 text-xs text-slate-500">JPG, PNG, or WebP · up to 5 MB. Landscape images work best.</p>
              {(file || slide.image_url) && <button type="button" disabled={busy} className="mt-2 text-sm font-bold text-red-600" onClick={() => { setFile(null); setPreviewUrl(''); update('image_url', '') }}>Remove image</button>}
            </div>
            {([
              ['pre_title', 'Pre-title', 100], ['title', 'Title *', 180], ['subtitle', 'Subtitle / description', 400], ['button_text', 'Button text', 60], ['button_url', 'Button URL', 2048],
            ] as const).map(([key, label, max]) => <label key={key} className="block text-sm font-bold">{label}
              {key === 'subtitle' ? <textarea className={inputClass} rows={3} maxLength={max} value={slide[key]} disabled={busy} onChange={event => update(key, event.target.value)} /> : <input className={inputClass} maxLength={max} required={key === 'title'} value={slide[key]} disabled={busy} placeholder={key === 'button_url' ? '/tours' : undefined} onChange={event => update(key, event.target.value)} />}
            </label>)}
          </div>
          <div className="space-y-5">
            <div><p className="mb-2 text-sm font-bold">Slide preview</p><HeroSlidePreview slide={{ ...slide, image_url: previewUrl || slide.image_url }} /></div>
            <fieldset disabled={busy}><legend className="mb-2 text-sm font-bold">Text position</legend>
              <div className="grid grid-cols-3 gap-2">{heroPositions.map(position => <label key={position} className={`cursor-pointer rounded-xl border p-2 text-center text-xs capitalize ${slide.text_position === position ? 'border-brand-400 bg-brand-50 text-brand-800' : 'border-slate-200'}`}>
                <input type="radio" name="hero-position" value={position} checked={slide.text_position === position} onChange={() => update('text_position', position)} className="mr-1 accent-brand-500" />{position.replaceAll('-', ' ')}
              </label>)}</div>
            </fieldset>
            <label className="flex items-center gap-3 text-sm font-bold"><input type="checkbox" checked={slide.is_active} disabled={busy} onChange={event => update('is_active', event.target.checked)} className="h-4 w-4 accent-brand-500" />Active (shown after publishing)</label>
            <p className="text-sm text-slate-500">Saving updates your draft. Use Publish in Customize to make changes live.</p>
          </div>
        </div>
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4">
          <button type="button" disabled={busy} onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={busy || (!file && !slide.image_url)} className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-50">{uploading ? 'Uploading image…' : busy ? 'Saving slide…' : 'Save slide to draft'}</button>
        </div>
      </form>
    </dialog>, document.body,
  )
}
