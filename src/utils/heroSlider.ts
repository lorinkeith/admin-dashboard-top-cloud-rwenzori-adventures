import { heroPositions, type HeroSlide, type HeroSliderContent } from '../types/heroSlider'

function hasUnsafeCharacters(value: string) {
  return Array.from(value).some(character => character.charCodeAt(0) < 32 || character === '\\')
}

export function isSafeHeroLink(value: string) {
  if (!value || /\s/.test(value) || hasUnsafeCharacters(value)) return false
  if (value.startsWith('/') && !value.startsWith('//')) return true
  if (value.startsWith('#')) return true
  try {
    const url = new URL(value)
    return ['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol)
  } catch { return false }
}

export function isSafeHeroImage(value: string) {
  if (hasUnsafeCharacters(value)) return false
  if (/^\/(?!\/)/.test(value)) return true
  try { return ['https:', 'http:'].includes(new URL(value).protocol) } catch { return false }
}

export function validateHeroSlide(slide: HeroSlide) {
  if (!isSafeHeroImage(slide.image_url)) return 'Please upload a hero image.'
  if (!slide.title.trim()) return 'Please enter a title.'
  if (slide.title.length > 180 || slide.pre_title.length > 100 || slide.subtitle.length > 400) return 'Please shorten the slide text.'
  if (slide.button_text.length > 60) return 'Button text must be 60 characters or fewer.'
  if (Boolean(slide.button_text.trim()) !== Boolean(slide.button_url.trim())) return 'Enter both button text and a button URL, or leave both empty.'
  if (slide.button_url && !isSafeHeroLink(slide.button_url)) return 'Use a page path, https URL, email, phone, or anchor link.'
  if (!heroPositions.includes(slide.text_position)) return 'Please choose a text position.'
  return null
}

// Treat database content as untrusted. One malformed slide must not hide valid ones.
export function normalizeHeroSlider(value: unknown): HeroSliderContent {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const slides: HeroSlide[] = []
  const ids = new Set<string>()
  if (Array.isArray(record.slides)) for (const item of record.slides) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    if (typeof row.id !== 'string' || ids.has(row.id) || typeof row.title !== 'string' || !row.title.trim() || typeof row.image_url !== 'string' || !isSafeHeroImage(row.image_url)) continue
    ids.add(row.id)
    const string = (key: string, limit: number) => typeof row[key] === 'string' ? (row[key] as string).slice(0, limit) : ''
    const buttonUrl = string('button_url', 2048)
    slides.push({
      id: row.id, image_url: row.image_url, title: row.title.slice(0, 180),
      pre_title: string('pre_title', 100), subtitle: string('subtitle', 400),
      button_url: isSafeHeroLink(buttonUrl) ? buttonUrl : '', button_text: string('button_text', 60),
      text_position: heroPositions.includes(row.text_position as HeroSlide['text_position']) ? row.text_position as HeroSlide['text_position'] : 'bottom-right',
      sort_order: Number.isInteger(row.sort_order) ? row.sort_order as number : slides.length,
      is_active: row.is_active === true,
    })
  }
  return {
    slides: slides.sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id)),
    autoplay: typeof record.autoplay === 'boolean' ? record.autoplay : true,
    duration_seconds: [3, 5, 7, 10].includes(record.duration_seconds as number) ? record.duration_seconds as number : 5,
  }
}

export function reorderHeroSlides(slides: HeroSlide[], index: number, direction: -1 | 1) {
  const result = [...slides]
  const target = index + direction
  if (index < 0 || index >= result.length || target < 0 || target >= result.length) return result
  ;[result[index], result[target]] = [result[target], result[index]]
  return result.map((slide, sort_order) => ({ ...slide, sort_order }))
}

export function heroPositionStyle(position: HeroSlide['text_position']) {
  const textAlign = position.endsWith('left') ? 'left' as const : position.endsWith('right') ? 'right' as const : 'center' as const
  return {
    justifyContent: position.startsWith('top') ? 'flex-start' : position.startsWith('bottom') ? 'flex-end' : 'center',
    alignItems: textAlign === 'left' ? 'flex-start' : textAlign === 'right' ? 'flex-end' : 'center',
    textAlign,
  }
}
