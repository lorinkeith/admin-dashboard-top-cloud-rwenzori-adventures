const FALLBACK_AUTHOR_IMAGE = '/brand/Fav_icon.png'
const MAX_REVIEWS = 24

const corsHeaders = {
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
}

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function getEnvValue(env, name) {
  return env?.[name] ?? (typeof process !== 'undefined' ? process.env?.[name] : undefined)
}

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), { status, headers: corsHeaders })
}

function htmlDecode(value) {
  return clean(value)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x2F;/g, '/')
}

function stripTags(value) {
  return htmlDecode(String(value ?? '').replace(/<[^>]*>/g, ' '))
}

function normalizeReviewDate(value) {
  const cleaned = clean(value)
  if (!cleaned) return null

  const parsed = new Date(cleaned)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function validateTripAdvisorUrl(value) {
  let parsed

  try {
    parsed = new URL(value)
  } catch {
    throw new Error('Enter a valid TripAdvisor business URL.')
  }

  const host = parsed.hostname.replace(/^www\./, '').toLowerCase()
  if (host !== 'tripadvisor.com' && host !== 'tripadvisor.co.uk') {
    throw new Error('The URL must belong to TripAdvisor.')
  }

  if (!/Attraction_Review|Hotel_Review|Restaurant_Review|VacationRentalReview|ShowUserReviews/i.test(parsed.pathname)) {
    throw new Error('Enter a TripAdvisor business reviews URL.')
  }

  return parsed.toString()
}

function getAuthToken(request) {
  const header = request?.headers?.get('Authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1]
}

function getSupabaseConfig(env, request) {
 const url = getEnvValue(env,'SUPABASE_URL')?.replace(/\/$/,'')
 const key = getEnvValue(env,'SUPABASE_PUBLISHABLE_KEY')
 if (!url || !key?.startsWith('sb_publishable_')) throw new Error('Configure the new Top Cloud Supabase URL and publishable key.')
 return {url,key,token:getAuthToken(request)}
}
async function supabaseRequest(env,request,path,init={}) {
 const {url,key,token}=getSupabaseConfig(env,request)
 const response=await fetch(`${url}/rest/v1/${path}`,{...init,headers:{apikey:key,...(token?{Authorization:`Bearer ${token}`} : {}),'Content-Type':'application/json',...(init.headers||{})}})
 if (!response.ok) throw new Error('Supabase denied the review request. Check administrator access and setup.')
 return response
}
async function isAuthorized(env,request) {
 const {token}=getSupabaseConfig(env,request)
 if (!token) return false
 const result=await supabaseRequest(env,request,'rpc/is_admin',{method:'POST',body:'{}'})
 return await result.json() === true
}

function extractJsonLdReviews(html) {
  const reviews = []
  const scripts = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || []

  for (const script of scripts) {
    const content = script.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '').trim()
    let json

    try {
      json = JSON.parse(htmlDecode(content))
    } catch {
      continue
    }

    const nodes = Array.isArray(json) ? json : [json]
    for (const node of nodes) {
      const nodeReviews = Array.isArray(node?.review) ? node.review : node?.review ? [node.review] : []

      for (const review of nodeReviews) {
        const text = clean(review.reviewBody || review.description || review.text)
        if (!text) continue

        const author = typeof review.author === 'object' ? review.author?.name : review.author
        const rating = Number(review.reviewRating?.ratingValue || review.ratingValue || 5)
        const date = normalizeReviewDate(review.datePublished || review.dateCreated)
        const idSeed = clean(review['@id'] || review.url || `${author}-${date}-${text.slice(0, 28)}`)

        reviews.push({
          review_id: createReviewId(idSeed),
          author_name: clean(author) || 'TripAdvisor traveler',
          author_image: FALLBACK_AUTHOR_IMAGE,
          rating: Number.isFinite(rating) ? Math.max(1, Math.min(5, Math.round(rating))) : 5,
          review_text: text,
          review_date: date,
        })
      }
    }
  }

  return reviews
}

function createReviewId(seed) {
  const match = String(seed).match(/(?:-r|review_?|Review-|reviews\/)(\d{6,})/i)
  if (match) return match[1]

  let hash = 0
  const input = clean(seed).toLowerCase()
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(index)) | 0
  }
  return `ta-${Math.abs(hash)}`
}

function extractMarkupReviews(html) {
  const reviews = []
  const reviewBlocks = html.match(/<div[^>]+data-reviewid=["'][^"']+["'][\s\S]*?(?=<div[^>]+data-reviewid=|<\/body>)/gi) || []

  for (const block of reviewBlocks) {
    const id = block.match(/data-reviewid=["']([^"']+)["']/i)?.[1]
    const authorImage = block.match(/<img[^>]+(?:class=["'][^"']*(?:avatar|profile)[^"']*["'][^>]+)?src=["']([^"']+)["']/i)?.[1]
    const title = stripTags(block.match(/<[^>]+class=["'][^"']*(?:noQuotes|title)[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1] || '')
    const text =
      stripTags(block.match(/<q[^>]*>([\s\S]*?)<\/q>/i)?.[1] || '') ||
      stripTags(block.match(/<span[^>]+class=["'][^"']*(?:partial_entry|reviewText)[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] || '')
    const author =
      stripTags(block.match(/<[^>]+class=["'][^"']*(?:info_text|username|member_info)[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1] || '') ||
      'TripAdvisor traveler'
    const ratingClass = block.match(/ui_bubble_rating bubble_(\d\d)/i)?.[1]
    const rating = ratingClass ? Number(ratingClass) / 10 : 5
    const date = normalizeReviewDate(stripTags(block.match(/<[^>]+class=["'][^"']*(?:ratingDate|date)[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1] || ''))
    const reviewText = clean([title, text].filter(Boolean).join(' - '))

    if (!id || !reviewText) continue

    reviews.push({
      review_id: createReviewId(id),
      author_name: clean(author),
      author_image: authorImage || FALLBACK_AUTHOR_IMAGE,
      rating: Number.isFinite(rating) ? Math.max(1, Math.min(5, Math.round(rating))) : 5,
      review_text: reviewText,
      review_date: date,
    })
  }

  return reviews
}

function dedupeReviews(reviews) {
  const byId = new Map()

  for (const review of reviews) {
    if (!review.review_id || !review.review_text) continue
    if (!byId.has(review.review_id)) byId.set(review.review_id, review)
  }

  return Array.from(byId.values()).slice(0, MAX_REVIEWS)
}

async function scrapeTripAdvisorReviews(url) {
  const response = await fetch(url, {
    redirect: 'error',
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
    },
  })

  if (!response.ok) {

    throw new Error(`TripAdvisor returned HTTP ${response.status}. Try again later.`)
  }

  const html = await response.text()
  return dedupeReviews([...extractJsonLdReviews(html), ...extractMarkupReviews(html)])
}

async function getExistingReviewIds(env, request, reviewIds) {
  if (reviewIds.length === 0) return new Set()

  const encoded = reviewIds.map((id) => `"${id.replace(/"/g, '\\"')}"`).join(',')
  const response = await supabaseRequest(env, request, `tripadvisor_reviews?select=review_id&review_id=in.(${encoded})`)
  const rows = await response.json()

  return new Set((rows || []).map((row) => row.review_id))
}

async function insertReviews(env, request, reviews) {
  if (reviews.length === 0) return []

  const response = await supabaseRequest(env, request, 'tripadvisor_reviews?on_conflict=review_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify(reviews),
  })

  return response.json()
}

export async function onRequestOptions() {
  return jsonResponse(200, { success: true })
}

export async function onRequestPost({ request, env }) {
  try { if (!await isAuthorized(env,request)) return jsonResponse(403,{success:false,error:'Administrator access required.'}) }
  catch { return jsonResponse(403,{success:false,error:'Administrator access required or Supabase is not configured.'}) }
  let body

  try {
    body = await request.json()
  } catch {
    return jsonResponse(400, { success: false, error: 'Invalid JSON request body.' })
  }

  let url

  try {
    url = validateTripAdvisorUrl(body?.url)
  } catch (error) {
    return jsonResponse(400, { success: false, error: error instanceof Error ? error.message : 'Invalid TripAdvisor URL.' })
  }

  try {
    const publish = Boolean(body?.publish)
    const postedReviews = Array.isArray(body?.reviews) ? dedupeReviews(body.reviews) : []
    const scrapedReviews = postedReviews.length > 0 ? postedReviews : await scrapeTripAdvisorReviews(url)

    if (scrapedReviews.length === 0) {
      return jsonResponse(404, { success: false, error: 'No reviews were found on that TripAdvisor page.' })
    }

    const existingIds = await getExistingReviewIds(env, request, scrapedReviews.map((review) => review.review_id))
    const newReviews = scrapedReviews.filter((review) => !existingIds.has(review.review_id))

    if (!publish) {
      return jsonResponse(200, {
        success: true,
        reviews: newReviews,
        skippedExisting: scrapedReviews.length - newReviews.length,
      })
    }

    const inserted = await insertReviews(env, request, newReviews)

    return jsonResponse(200, {
      success: true,
      reviews: inserted,
      insertedCount: inserted.length,
      skippedExisting: scrapedReviews.length - inserted.length,
    })
  } catch (error) {
    console.error('TripAdvisor review import failed:', error)
    return jsonResponse(502, {
      success: false,
      error: error instanceof Error ? error.message : 'TripAdvisor review import failed.',
    })
  }
}

export function onRequest() {
  return jsonResponse(405, { success: false, error: 'Method not allowed.' })
}
