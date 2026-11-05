import { type FormEvent, useEffect, useState } from 'react';

import { Button, PageHeader } from '../../components/blog/BlogUI';
import { deleteCategory, listCategories, saveCategory } from '../../lib/blogService';
import type { BlogCategory } from '../../types/blog';
import { slugify } from '../../utils/blog';

export function CategoriesPage() {
  const [items, setItems] = useState<BlogCategory[]>([]);
  const [editing, setEditing] = useState<BlogCategory | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() { setItems(await listCategories()); }
  useEffect(() => { void listCategories().then(setItems).catch((err) => setError(err.message)); }, []);

  function startEdit(item: BlogCategory) { setEditing(item); setName(item.name); setSlug(item.slug); setDescription(item.description ?? ''); }
  function reset() { setEditing(null); setName(''); setSlug(''); setDescription(''); }

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage('');
    try { await saveCategory({ id: editing?.id, name, slug: slug || slugify(name), description }); setMessage(editing ? 'Category updated.' : 'Category created.'); reset(); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save category.'); }
  }

  return <div className="space-y-8"><PageHeader eyebrow="Categories" title="Blog Categories" description="Create and maintain the topic structure used by Top Cloud Rwenzori Adventures articles." />{error ? <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p> : null}{message ? <p className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-700">{message}</p> : null}<div className="grid gap-6 lg:grid-cols-[24rem_1fr]"><form onSubmit={submit} className="rounded-2xl border border-admin-border bg-white p-5 shadow-sm"><h2 className="font-extrabold">{editing ? 'Edit Category' : 'New Category'}</h2><label className="mt-4 block text-sm font-bold">Name</label><input value={name} onChange={(e) => { setName(e.target.value); if (!editing) setSlug(slugify(e.target.value)); }} required className="mt-2 h-11 w-full rounded-xl border border-admin-border px-3 text-sm" /><label className="mt-4 block text-sm font-bold">Slug</label><input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} required className="mt-2 h-11 w-full rounded-xl border border-admin-border px-3 text-sm" /><label className="mt-4 block text-sm font-bold">Description</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-admin-border px-3 py-2 text-sm" /><div className="mt-5 flex gap-2"><Button type="submit">{editing ? 'Update' : 'Create'}</Button>{editing ? <button type="button" onClick={reset} className="rounded-xl border border-admin-border px-4 text-sm font-bold">Cancel</button> : null}</div></form><section className="overflow-hidden rounded-2xl border border-admin-border bg-white shadow-sm"><table className="w-full text-left text-sm"><thead className="bg-admin-background text-xs uppercase text-admin-muted"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Slug</th><th className="px-4 py-3">Actions</th></tr></thead><tbody className="divide-y divide-admin-border">{items.map((item) => <tr key={item.id}><td className="px-4 py-4 font-bold">{item.name}</td><td className="px-4 py-4 text-admin-muted">{item.slug}</td><td className="px-4 py-4"><button onClick={() => startEdit(item)} className="mr-2 rounded-lg border border-admin-border px-3 py-1.5 font-bold">Edit</button><button onClick={() => { if (window.confirm('Delete this category?')) void deleteCategory(item.id).then(load).catch((err) => setError(err.message)); }} className="rounded-lg border border-red-200 px-3 py-1.5 font-bold text-red-700">Delete</button></td></tr>)}</tbody></table></section></div></div>;
}
