import { useState } from 'react'
import type { HeroSliderContent } from '../../types/heroSlider'

export function HeroSettings({ value, disabled, onSave }: { value: HeroSliderContent; disabled: boolean; onSave: (settings: Pick<HeroSliderContent, 'autoplay' | 'duration_seconds'>) => Promise<void> }) {
  const [autoplay, setAutoplay] = useState(value.autoplay)
  const [duration, setDuration] = useState(value.duration_seconds)
  return <form className="space-y-3 rounded-xl border border-slate-200 bg-white p-3" onSubmit={event => { event.preventDefault(); void onSave({ autoplay, duration_seconds: duration }) }}>
    <h3 className="font-bold">Hero settings</h3>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={autoplay} disabled={disabled} onChange={event => setAutoplay(event.target.checked)} className="accent-brand-500" />Autoplay</label>
    <label className="block text-sm">Slide duration
      <select className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm" value={duration} disabled={disabled} onChange={event => setDuration(Number(event.target.value))}>{[3, 5, 7, 10].map(seconds => <option key={seconds} value={seconds}>{seconds} seconds</option>)}</select>
    </label>
    <button disabled={disabled} className="rounded-xl bg-brand-500 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{disabled ? 'Saving…' : 'Save hero settings'}</button>
  </form>
}
