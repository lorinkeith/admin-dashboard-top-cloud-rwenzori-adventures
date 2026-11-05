export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

export function htmlToText(html: string) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function getReadTime(content: string | null | undefined) {
  const words = htmlToText(content ?? '').split(' ').filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function toInputDateTime(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export function fromInputDateTime(value: string) {
  return value ? new Date(value).toISOString() : null;
}
