import type { HeroSlide } from '../../types/heroSlider'
import gorillaImage from '../../assets/gorilla-7708328_1280.jpg'
import { heroPreviewImage } from '../../utils/heroPreviewImage'
import { heroPositionStyle } from '../../utils/heroSlider'

export function HeroSlidePreview({ slide, large = false }: { slide: HeroSlide; large?: boolean }) {
  const style = heroPositionStyle(slide.text_position)
  return (
    <div className={`relative isolate overflow-hidden rounded-xl bg-slate-900 text-white ${large ? 'min-h-[75vh]' : 'aspect-video'}`} aria-label="Hero slide preview">
      {slide.image_url && <img src={heroPreviewImage(slide.image_url)} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = gorillaImage }} />}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/25 to-black/30" />
      <div className={`flex min-h-[inherit] w-full flex-col ${large ? 'p-6 py-24 md:p-16 md:py-28' : 'h-full p-4'}`} style={style}>
        <div className={`max-w-full break-words ${large ? 'w-full max-w-3xl' : 'w-4/5'}`}>
          <p className={large ? 'text-xl italic md:text-3xl' : 'text-[10px] italic'}>{slide.pre_title}</p>
          <p className={large ? 'mt-2 text-3xl font-normal leading-tight md:text-6xl' : 'mt-1 text-base font-normal leading-tight sm:text-xl'}>{slide.title || 'Your slide title'}</p>
          <p className={large ? 'mt-5 text-base leading-relaxed' : 'mt-2 text-[10px] leading-snug'}>{slide.subtitle}</p>
          {slide.button_text && <span className={`mt-4 inline-block rounded-full bg-brand-500 font-bold text-white ${large ? 'px-6 py-3 text-sm' : 'px-3 py-1.5 text-[9px]'}`}>{slide.button_text} →</span>}
        </div>
      </div>
    </div>
  )
}
