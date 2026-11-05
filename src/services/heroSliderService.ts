import { supabase } from '../lib/supabaseClient'
import type { HeroSliderContent } from '../types/heroSlider'
import { normalizeHeroSlider, validateHeroSlide } from '../utils/heroSlider'

const bucket = 'hero-slides'
const pendingUploads = new Set<string>()
const abandonedImages = new Set<string>()

export async function getHeroSliderEditorState(): Promise<{ allowed: boolean; draft?: HeroSliderContent; published?: HeroSliderContent; error?: string }> {
  if (!supabase) return { allowed: false, error: 'Connect Supabase to manage hero slides.' }
  const { data: allowed, error: accessError } = await supabase.rpc('is_hero_slider_admin')
  if (accessError) return { allowed: false, error: 'Hero setup is required. Run supabase/setup SQL files in order.' }
  if (!allowed) return { allowed: false, error: 'Ask the project owner to assign your account administrator membership using SUPABASE_SETUP_GUIDE.md.' }
  const { data, error } = await supabase.rpc('get_hero_slider_editor_state')
  if (error) return { allowed: false, error: 'Unable to load hero slides. Reload Customize to try again.' }
  return { allowed: true, draft: data?.draft ? normalizeHeroSlider(data.draft) : undefined, published: data?.published ? normalizeHeroSlider(data.published) : undefined }
}

export async function uploadHeroImage(file: File) {
  if (!supabase) throw new Error('Unable to connect to image storage.')
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024 || file.size === 0) {
    throw new Error('Choose a JPG, PNG, or WebP image smaller than 5 MB.')
  }
  const extension = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp'
  const path = `home/${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw new Error('Unable to upload the image. Please try again.')
  const url = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
  pendingUploads.add(url)
  return url
}

export function markHeroImageUnused(url: string) { if (url) abandonedImages.add(url) }

export async function saveHomepageWithHero(content: unknown, publish: boolean) {
  if (!supabase) throw new Error('Unable to connect to Supabase.')
  const slider = (content as { heroSlider: HeroSliderContent }).heroSlider
  if (slider.slides.length > 50) throw new Error('A maximum of 50 hero slides is supported.')
  for (const slide of slider.slides) {
    const message = validateHeroSlide(slide)
    if (message) throw new Error(message)
  }
  const { data: oldSlides, error: readError } = await supabase.from('hero_slides').select('image_url')
  if (readError) throw new Error('Unable to load hero slides. Please reload and try again.')
  const { data, error } = await supabase.rpc('save_homepage_with_hero', { p_content: content, p_publish: publish })
  if (error) throw new Error(`Unable to ${publish ? 'publish the homepage' : 'save the draft'}. Please try again. If you recently changed access settings, check your administrator membership and reload Customize.`)
  // Both snapshots have committed. Only remove files no longer referenced by
  // either snapshot; replacing a draft image must never break the live slide.
  const { data: references, error: referencesError } = await supabase.from('hero_slides').select('image_url')
  let cleanupWarning = false
  if (!referencesError) {
    const keep = new Set((references ?? []).map(row => row.image_url as string))
    const candidates = new Set([...pendingUploads, ...abandonedImages, ...(oldSlides ?? []).map(row => row.image_url as string)])
    const prefix = supabase.storage.from(bucket).getPublicUrl('').data.publicUrl
    for (const url of candidates) {
      if (keep.has(url) || !url.startsWith(prefix)) continue
      const path = url.slice(prefix.length).replace(/^\//, '')
      if (!/^home\/[a-f0-9-]+\.(jpg|jpeg|png|webp)$/.test(path)) continue
      const { error: cleanupError } = await supabase.storage.from(bucket).remove([path])
      if (cleanupError) { cleanupWarning = true; abandonedImages.add(url) }
      else { pendingUploads.delete(url); abandonedImages.delete(url) }
    }
  } else cleanupWarning = true
  return { data, cleanupWarning }
}
