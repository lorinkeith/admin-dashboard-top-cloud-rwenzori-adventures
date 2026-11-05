import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FiPlus } from 'react-icons/fi'
import type { HomeCustomizationContent } from '../../types/homeCustomization'
import type { HeroSlide, HeroSliderContent } from '../../types/heroSlider'
import { reorderHeroSlides } from '../../utils/heroSlider'
import { legacyHeroSlider } from '../../utils/legacyHeroSlider'
import { HeroSlideCard } from './HeroSlideCard'
import { HeroSlideForm } from './HeroSlideForm'
import { HeroSettings } from './HeroSettings'

function DeleteHeroDialog({ busy, error, onCancel, onDelete }: { busy: boolean; error: string; onCancel: () => void; onDelete: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { dialog.current?.showModal() }, [])
  return createPortal(<dialog ref={dialog} aria-labelledby="delete-hero-title" onCancel={event => { if (busy) event.preventDefault(); else onCancel() }} className="m-auto w-[calc(100%_-_2rem)] max-w-md rounded-2xl border-0 bg-white p-6 text-slate-900 shadow-xl backdrop:bg-slate-950/60">
    <h2 id="delete-hero-title" className="text-lg font-bold">Delete this hero slide?</h2><p className="mt-2 text-sm text-slate-600">This action cannot be undone. The slide is removed from the draft; the live website changes when you publish.</p>
    {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="mt-5 flex justify-end gap-3"><button disabled={busy} type="button" onClick={onCancel} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold">Cancel</button><button disabled={busy} type="button" onClick={onDelete} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white">{busy ? 'Deleting…' : 'Delete'}</button></div>
  </dialog>, document.body)
}


export function HeroSlidesManager({ value, legacyHero, allowed, accessError, disabled, onChange, onPreview }: { value?: HeroSliderContent; legacyHero: HomeCustomizationContent['hero']; allowed: boolean; accessError?: string; disabled: boolean; onChange: (value: HeroSliderContent) => Promise<void>; onPreview: (id: string) => void }) {
  const slider = value ?? legacyHeroSlider(legacyHero)
  const [editing, setEditing] = useState<{ slide: HeroSlide; isNew: boolean } | null>(null)
  const [deleting, setDeleting] = useState<HeroSlide | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const commit = async (next: HeroSliderContent, success: string, propagate = false) => {
    setBusy(true); setError(''); setMessage('')
    try { await onChange(next); setMessage(success); return true }
    catch { setError('Unable to save hero changes. Please try again.'); if (propagate) throw new Error('Unable to save this slide. Please try again.'); return false }
    finally { setBusy(false) }
  }
  if (!allowed) return <p role="alert" className="rounded-xl border border-brand-300/30 p-3 text-sm">{accessError || 'Please sign in to manage hero slides.'}</p>
  return <div className="space-y-4">
    <p className="text-sm leading-relaxed text-slate-500">Manage the slides on your homepage. Changes save as a draft. Select Publish to update the live website.</p>
    {message && <p role="status" className="rounded-xl bg-emerald-100 p-3 text-sm text-emerald-800">{message}</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <button type="button" disabled={disabled || busy || slider.slides.length >= 50} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-3 py-3 text-sm font-bold text-white disabled:opacity-50" onClick={() => setEditing({ isNew: true, slide: { id: crypto.randomUUID(), image_url: '', pre_title: '', title: '', subtitle: '', button_text: 'Explore Our Tours', button_url: '/tours', text_position: 'bottom-right', sort_order: slider.slides.length, is_active: true } })}><FiPlus />Add New Slide</button>
    <HeroSettings key={`${slider.autoplay}-${slider.duration_seconds}`} value={slider} disabled={disabled || busy} onSave={async settings => { await commit({ ...slider, ...settings }, 'Hero settings saved to draft.') }} />
    {busy && <p role="status" className="text-sm">Saving hero changes…</p>}
    {slider.slides.length === 0 && <p className="p-3 text-sm text-slate-500">No slides yet. The existing homepage hero remains the fallback.</p>}
    {slider.slides.map((slide, index) => <HeroSlideCard key={slide.id} slide={slide} index={index} count={slider.slides.length} disabled={disabled || busy} onPreview={() => onPreview(slide.id)} onEdit={() => { onPreview(slide.id); setEditing({ slide, isNew: false }) }} onDelete={() => setDeleting(slide)} onMove={direction => { void commit({ ...slider, slides: reorderHeroSlides(slider.slides, index, direction) }, 'Hero slide order saved to draft.') }} onToggle={() => { void commit({ ...slider, slides: slider.slides.map(item => item.id === slide.id ? { ...item, is_active: !item.is_active } : item) }, 'Hero slide status saved to draft.') }} />)}
    {editing && <HeroSlideForm key={editing.slide.id} initial={editing.slide} isNew={editing.isNew} onClose={() => setEditing(null)} onSave={async slide => {
      const slides = editing.isNew ? [...slider.slides, slide] : slider.slides.map(item => item.id === slide.id ? slide : item)
      await commit({ ...slider, slides: slides.map((item, sort_order) => ({ ...item, sort_order })) }, `Hero slide ${editing.isNew ? 'created' : 'updated'} successfully in draft.`, true)
      onPreview(slide.id)
    }} />}
    {deleting && <DeleteHeroDialog busy={busy} error={error} onCancel={() => setDeleting(null)} onDelete={() => { void (async () => {
      const next = slider.slides.filter(slide => slide.id !== deleting.id).map((slide, sort_order) => ({ ...slide, sort_order }))
      if (await commit({ ...slider, slides: next }, 'Hero slide deleted from draft.')) { setDeleting(null) }
    })() }} />}
  </div>
}
