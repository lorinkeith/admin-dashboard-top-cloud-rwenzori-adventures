export const heroPositions = ['top-left', 'top-center', 'top-right', 'center-left', 'center', 'center-right', 'bottom-left', 'bottom-center', 'bottom-right'] as const
export type HeroPosition = typeof heroPositions[number]
export type HeroSlide = {
  id: string
  image_url: string
  pre_title: string
  title: string
  subtitle: string
  button_text: string
  button_url: string
  text_position: HeroPosition
  sort_order: number
  is_active: boolean
}
export type HeroSliderContent = {
  slides: HeroSlide[]
  autoplay: boolean
  duration_seconds: number
}
