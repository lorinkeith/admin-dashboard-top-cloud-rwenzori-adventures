import { supabase } from '../lib/supabaseClient'
import { getPublicImageUrl, sanitizeFileName, validateImageFile } from './storageService'
import { defaultHomeCustomization, mergeHomeCustomization } from './homeCustomizationDefaults'
import type { HomeCustomizationContent, HomepageCustomizationRow } from '../types/homeCustomization'
import { getHeroSliderEditorState, saveHomepageWithHero } from './heroSliderService'

const PAGE_KEY = 'home'
const TOUR_IMAGES_BUCKET = 'tour-images'

type HomepageCustomizationElement = {
  page_key: string
  section_name: string
  element_key: string
  element_type: 'text' | 'image' | 'icon' | 'button' | 'link' | 'section' | 'json'
  content_value: unknown
  metadata: Record<string, unknown>
  is_published: boolean
}

function getSupabaseClient() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env.')
  }

  return supabase
}

async function requireAuthenticatedUser() {
  const client = getSupabaseClient()
  const { data, error } = await client.auth.getSession()

  if (error) throw new Error(error.message)
  if (!data.session) throw new Error('You must be logged in to customize the homepage.')

  return client
}

export async function getHomepageCustomization() {
  const client = getSupabaseClient()
  const { data, error } = await client
    .from('homepage_customizations')
    .select('*')
    .eq('page_key', PAGE_KEY)
    .maybeSingle()

  if (error) throw new Error(error.message)

  const heroState = await getHeroSliderEditorState()
  const attachHero = (content: HomeCustomizationContent, stage: 'draft' | 'published') => ({
    ...content,
    ...(heroState[stage] ? { heroSlider: heroState[stage] } : {}),
  })

  if (!data) {
    return {
      row: null,
      draft: attachHero(defaultHomeCustomization, 'draft'),
      published: attachHero(defaultHomeCustomization, 'published'),
      heroState,
    }
  }

  const row = data as HomepageCustomizationRow

  return {
    row,
    draft: attachHero(mergeHomeCustomization(row.draft_content), 'draft'),
    published: attachHero(mergeHomeCustomization(row.published_content), 'published'),
    heroState,
  }
}

export async function saveHomepageDraft(content: HomeCustomizationContent) {
  if (content.heroSlider) {
    const result = await saveHomepageWithHero(content, false)
    const elementSyncWarning = await syncHomepageElements(content, false).then(() => false, () => true)
    return { ...result, elementSyncWarning }
  }
  const client = await requireAuthenticatedUser()
  const { data, error } = await client
    .from('homepage_customizations')
    .upsert(
      {
        page_key: PAGE_KEY,
        draft_content: content,
      },
      { onConflict: 'page_key' },
    )
    .select()
    .single()

  if (error) throw new Error(error.message)
  await syncHomepageElements(content, false)
  return data as HomepageCustomizationRow
}

export async function publishHomepageCustomization(content: HomeCustomizationContent) {
  if (content.heroSlider) {
    const result = await saveHomepageWithHero(content, true)
    const draftSyncWarning = await syncHomepageElements(content, false).then(() => false, () => true)
    const publishedSyncWarning = await syncHomepageElements(content, true).then(() => false, () => true)
    return { ...result, elementSyncWarning: draftSyncWarning || publishedSyncWarning }
  }
  const client = await requireAuthenticatedUser()
  const { data, error } = await client
    .from('homepage_customizations')
    .upsert(
      {
        page_key: PAGE_KEY,
        draft_content: content,
        published_content: content,
        published_at: new Date().toISOString(),
      },
      { onConflict: 'page_key' },
    )
    .select()
    .single()

  if (error) throw new Error(error.message)
  await syncHomepageElements(content, false)
  await syncHomepageElements(content, true)
  return data as HomepageCustomizationRow
}

function getElementType(path: string, value: unknown): HomepageCustomizationElement['element_type'] {
  const lowerPath = path.toLowerCase()

  if (lowerPath.endsWith('.src') || lowerPath.includes('image') || lowerPath.includes('background') || lowerPath.startsWith('footerband')) {
    return 'image'
  }

  if (lowerPath.endsWith('.icon')) return 'icon'
  if (lowerPath.includes('button') || lowerPath.includes('cta') || lowerPath.includes('inquirybutton')) return 'button'
  if (lowerPath.includes('links') || lowerPath.includes('socials') || lowerPath.endsWith('.href')) return 'link'
  if (typeof value === 'object') return 'json'
  return 'text'
}

function flattenHomepageElements(
  value: unknown,
  path: string[] = [],
  rows: HomepageCustomizationElement[] = [],
  isPublished = false,
) {
  if (value === undefined) return rows

  if (value !== null && typeof value === 'object') {
    if (Array.isArray(value)) {
      rows.push({
        page_key: PAGE_KEY,
        section_name: path[0] ?? 'home',
        element_key: path.join('.') || 'home',
        element_type: 'json',
        content_value: value,
        metadata: { item_count: value.length },
        is_published: isPublished,
      })

      value.forEach((item, index) => flattenHomepageElements(item, [...path, String(index)], rows, isPublished))
      return rows
    }

    Object.entries(value as Record<string, unknown>).forEach(([key, entryValue]) => {
      flattenHomepageElements(entryValue, [...path, key], rows, isPublished)
    })
    return rows
  }

  const elementKey = path.join('.')
  rows.push({
    page_key: PAGE_KEY,
    section_name: path[0] ?? 'home',
    element_key: elementKey,
    element_type: getElementType(elementKey, value),
    content_value: value,
    metadata: {},
    is_published: isPublished,
  })

  return rows
}

async function syncHomepageElements(content: HomeCustomizationContent, isPublished: boolean) {
  const client = await requireAuthenticatedUser()
  // Hero snapshots are secured separately. Never copy inactive/draft slides to
  // the public element mirror.
  const { heroSlider: _heroSlider, ...homepageContent } = content
  void _heroSlider
  const rows = flattenHomepageElements(homepageContent, [], [], isPublished)

  const { error: deleteError } = await client
    .from('homepage_customization_elements')
    .delete()
    .eq('page_key', PAGE_KEY)
    .eq('is_published', isPublished)

  if (deleteError) throw new Error(deleteError.message)
  if (rows.length === 0) return

  const { error: insertError } = await client
    .from('homepage_customization_elements')
    .insert(rows)

  if (insertError) throw new Error(insertError.message)
}

export async function uploadHomepageImage(file: File, sectionId: string) {
  const validationError = validateImageFile(file)

  if (validationError) throw new Error(validationError)

  const safeSectionId = sectionId.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-') || 'section'
  const safeFileName = sanitizeFileName(file.name)
  const path = `customize/home/${safeSectionId}/${Date.now()}-${safeFileName}`

  const { error } = await getSupabaseClient()
    .storage
    .from(TOUR_IMAGES_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    })

  if (error) throw new Error(error.message)

  return getPublicImageUrl(path)
}
