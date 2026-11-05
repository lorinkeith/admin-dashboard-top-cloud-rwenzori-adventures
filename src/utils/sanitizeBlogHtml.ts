import DOMPurify from 'dompurify'
export function sanitizeBlogHtml(html: string | null | undefined) {
  return DOMPurify.sanitize(html ?? '', { USE_PROFILES: { html: true }, FORBID_TAGS: ['style', 'form', 'input', 'button'], FORBID_ATTR: ['style'] })
}
