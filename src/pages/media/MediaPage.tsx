import { useEffect, useState } from 'react';

import { PageHeader } from '../../components/blog/BlogUI';
import { deleteMedia, listMedia, uploadBlogImage } from '../../lib/blogService';
import type { BlogMediaItem } from '../../types/blog';
import { formatDate } from '../../utils/blog';

export function MediaPage() {
  const [items, setItems] = useState<BlogMediaItem[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  async function load() { setItems(await listMedia()); }
  useEffect(() => { void listMedia().then(setItems).catch((err) => setError(err.message)); }, []);
  async function handleUpload(file: File) { setUploading(true); setError(''); setMessage(''); try { await uploadBlogImage(file, 'content', 'library'); setMessage('Image uploaded.'); await load(); } catch (err) { setError(err instanceof Error ? err.message : 'Upload failed.'); } finally { setUploading(false); } }
  return <div className="space-y-8"><PageHeader eyebrow="Media" title="Blog Media" description="View, upload, copy, and delete images stored in the blog-images bucket." />{error ? <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p> : null}{message ? <p className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-700">{message}</p> : null}<section className="rounded-2xl border border-admin-border bg-white p-5"><label className="text-sm font-bold">Upload image</label><input className="mt-3 block text-sm" type="file" accept="image/jpeg,image/jpg,image/png,image/webp,image/avif" disabled={uploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) void handleUpload(file); }} /></section><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{items.length ? items.map((item) => <article key={item.path} className="overflow-hidden rounded-2xl border border-admin-border bg-white shadow-sm"><img src={item.publicUrl} alt={item.name} className="aspect-video w-full object-cover" /><div className="p-4"><p className="truncate text-sm font-bold text-admin-dark">{item.name}</p><p className="mt-1 text-xs text-admin-muted">{formatDate(item.created_at)}</p><div className="mt-4 flex gap-2"><button onClick={() => void navigator.clipboard.writeText(item.publicUrl)} className="rounded-lg border border-admin-border px-3 py-1.5 text-xs font-bold">Copy URL</button><button onClick={() => { if (window.confirm('Delete this media item? Check that it is not used first.')) void deleteMedia(item.path).then(load).catch((err) => setError(err.message)); }} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700">Delete</button></div></div></article>) : <p className="rounded-2xl border border-admin-border bg-white p-8 text-sm text-admin-muted">No media found.</p>}</section></div>;
}
