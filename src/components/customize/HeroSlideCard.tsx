import { FiArrowDown, FiArrowUp, FiEdit3, FiTrash2 } from 'react-icons/fi'
import type { HeroSlide } from '../../types/heroSlider'
import { heroPreviewImage } from '../../utils/heroPreviewImage'

export function HeroSlideCard({ slide, index, count, disabled, onEdit, onDelete, onMove, onToggle, onPreview }: { slide: HeroSlide; index: number; count: number; disabled: boolean; onEdit: () => void; onDelete: () => void; onMove: (direction: -1 | 1) => void; onToggle: () => void; onPreview: () => void }) {
  return <article className="overflow-hidden rounded-xl border border-slate-200 bg-white">
    <button type="button" className="block w-full text-left" onClick={onPreview} aria-label={`Preview ${slide.title}`}>
      <img src={heroPreviewImage(slide.image_url)} alt="" className="h-28 w-full object-cover" />
      <div className="p-3"><p className="text-xs text-slate-500">Slide {String(index + 1).padStart(2, '0')} · {slide.pre_title}</p><h3 className="mt-1 break-words text-sm font-bold">{slide.title}</h3></div>
    </button>
    <div className="flex flex-wrap items-center gap-2 px-3 pb-3">
      <button type="button" disabled={disabled} onClick={onToggle} className={`rounded-full px-2 py-1 text-xs font-bold ${slide.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`} aria-label={`${slide.is_active ? 'Deactivate' : 'Activate'} ${slide.title}`}>{slide.is_active ? 'Active' : 'Inactive'}</button>
      <button type="button" disabled={disabled} onClick={onEdit} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold hover:bg-brand-50"><FiEdit3 />Edit</button>
      <button type="button" disabled={disabled} onClick={onDelete} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50"><FiTrash2 />Delete</button>
      <div className="ml-auto flex gap-1"><button type="button" disabled={disabled || index === 0} onClick={() => onMove(-1)} aria-label={`Move ${slide.title} up`} className="rounded-lg p-2 hover:bg-slate-100 disabled:opacity-30"><FiArrowUp /></button><button type="button" disabled={disabled || index === count - 1} onClick={() => onMove(1)} aria-label={`Move ${slide.title} down`} className="rounded-lg p-2 hover:bg-slate-100 disabled:opacity-30"><FiArrowDown /></button></div>
    </div>
  </article>
}
