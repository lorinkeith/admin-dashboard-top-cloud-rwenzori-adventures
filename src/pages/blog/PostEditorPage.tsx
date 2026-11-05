
import { type ChangeEvent, useEffect, useMemo, useState } from 'react';
import { FiChevronLeft, FiEdit3, FiImage, FiMessageSquare, FiPlus, FiSearch, FiTrash2, FiUploadCloud, FiX } from 'react-icons/fi';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { RichTextEditor } from '../../components/editor/RichTextEditor';
import { Button } from '../../components/blog/BlogUI';
import { createTagByName, deleteComment, getPost, listCategories, listComments, listMedia, listTags, saveCategory, savePost, updateComment, updateCommentStatus, updatePostStatus, uploadBlogImage } from '../../lib/blogService';
import type { BlogCategory, BlogComment, BlogMediaItem, BlogPost, BlogStatus, BlogTag, CommentStatus } from '../../types/blog';
import { formatDate, fromInputDateTime, slugify, toInputDateTime } from '../../utils/blog';
import { useAuth } from '../../hooks/useAuth';

type EditorTab = 'content' | 'settings' | 'seo';
type Modal = 'media' | 'category' | 'comments' | null;

const blankPost: BlogPost = {
  id: '', title: '', slug: '', excerpt: '', content: '', featured_image_url: '', featured_image_path: '', featured_image_alt: '', category_id: null, author_id: null, author_name: 'Top Cloud Rwenzori Adventures Team', status: 'draft', seo_title: '', meta_description: '', focus_keyword: '', seo_keywords: [], canonical_url: '', is_featured: false, allow_comments: true, published_at: null, scheduled_at: null, created_at: '', updated_at: '', blog_tags: [],
};

const tabLabels: Record<EditorTab, string> = { content: 'Content', settings: 'Settings', seo: 'SEO' };
const statusLabels: Record<BlogStatus, string> = { draft: 'Draft', published: 'Published', scheduled: 'Scheduled', archived: 'Archived' };
type SavingAction = 'draft' | 'publish' | null;

function FieldLabel({ children, meta, helper }: { children: string; meta?: string; helper?: string }) {
  return <div className="mb-2 flex items-end justify-between gap-3"><div><label className="text-sm font-extrabold text-admin-dark">{children}</label>{helper ? <p className="mt-1 text-xs font-semibold text-admin-muted">{helper}</p> : null}</div>{meta ? <span className="text-xs font-bold text-admin-muted">{meta}</span> : null}</div>;
}

function getPlainText(html: string | null | undefined) {
  return (html ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
function ToggleSwitch({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-center justify-between rounded-[10px] border border-admin-border bg-white px-3 py-2.5 text-sm font-bold text-admin-dark hover:bg-admin-background"><span>{label}</span><span className={`flex h-5 w-9 items-center rounded-full p-0.5 transition ${checked ? 'bg-brand-500' : 'bg-zinc-300'}`}><span className={`size-4 rounded-full bg-white transition ${checked ? 'translate-x-4' : 'translate-x-0'}`} /></span></button>;
}

export function PostEditorPage({ mode }: { mode: 'new' | 'edit' }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [post, setPost] = useState<BlogPost>({ ...blankPost });
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [tags, setTags] = useState<BlogTag[]>([]);
  const [comments, setComments] = useState<BlogComment[]>([]);
  const [media, setMedia] = useState<BlogMediaItem[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [mediaSearch, setMediaSearch] = useState('');
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [savingAction, setSavingAction] = useState<SavingAction>(null);
  const [uploading, setUploading] = useState(false);
  const [savedState, setSavedState] = useState('');
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [activeTab, setActiveTab] = useState<EditorTab>('content');
  const [modal, setModal] = useState<Modal>(null);
  const [newCategory, setNewCategory] = useState({ name: '', slug: '', description: '' });
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; actionLabel: string; onConfirm: () => Promise<void> } | null>(null);
  const [editingComment, setEditingComment] = useState<{ id: string; name: string; email: string; comment: string } | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true); setError('');
      try {
        const [categoryData, tagData, commentData, mediaData] = await Promise.all([listCategories(), listTags(), listComments('all'), listMedia()]);
        setCategories(categoryData); setTags(tagData); setComments(commentData); setMedia(mediaData);
        if (mode === 'edit' && id) {
          const data = await getPost(id);
          setPost(data); setSelectedTags(data.blog_tags?.map((tag) => tag.id) ?? []);
        } else {
          const nextPost = { ...blankPost, author_id: session?.user.id ?? null };
          setPost(nextPost); setSelectedTags([]);
        }
      } catch (err) { setError(err instanceof Error ? err.message : 'Could not load article editor.'); }
      finally { setLoading(false); }
    }
    void load();
  }, [id, mode, session?.user.id]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault(); event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const selectedCategory = categories.find((category) => category.id === post.category_id) ?? null;
  const relatedComments = comments.filter((comment) => comment.post_id === post.id);
  const pendingComments = relatedComments.filter((comment) => comment.status === 'pending').length;
  const selectedTagObjects = tags.filter((tag) => selectedTags.includes(tag.id));
  const seoTitle = post.seo_title || `${post.title || 'Untitled Article'} | Top Cloud Rwenzori Adventures`;
  const metaDescription = post.meta_description || post.excerpt || '';
  const keywordText = useMemo(() => (post.seo_keywords ?? []).join(', '), [post.seo_keywords]);
  const words = getPlainText(post.content).split(' ').filter(Boolean).length;
  const characters = ((post.title ?? '') + (post.excerpt ?? '') + getPlainText(post.content)).length;
  const publishLabel = post.status === 'scheduled' ? 'Update Schedule' : post.id && post.status === 'published' ? 'Update' : 'Publish';
  const filteredMedia = media.filter((item) => item.path.toLowerCase().includes(mediaSearch.toLowerCase()) || item.name.toLowerCase().includes(mediaSearch.toLowerCase()));

  function update<K extends keyof BlogPost>(key: K, value: BlogPost[K]) {
    setPost((current) => {
      const next = { ...current, [key]: value };
      if (key === 'title' && mode === 'new' && (!current.slug || current.slug === slugify(current.title))) next.slug = slugify(String(value));
      return next;
    });
    setDirty(true);
  }

  function validate(targetStatus: BlogStatus) {
    if (!post.title.trim()) return 'Title is required.';
    if (!post.slug.trim()) return 'Slug is required.';
    if (targetStatus !== 'draft' && !getPlainText(post.content)) return 'Content is required before publishing.';
    if (targetStatus === 'scheduled' && !post.scheduled_at) return 'Choose a schedule date and time.';
    return '';
  }

  async function handleSave(targetStatus: BlogStatus = post.status, autosave = false) {
    const validation = validate(targetStatus);
    if (validation) { setError(validation); return null; }
    setSaving(true); setSavingAction(targetStatus === 'draft' ? 'draft' : 'publish'); setError(''); setSavedState(autosave ? 'Autosaving...' : targetStatus === 'published' ? 'Publishing...' : 'Saving...');
    try {
      const saved = await savePost({ ...post, status: targetStatus, author_id: post.author_id ?? session?.user.id ?? null, slug: slugify(post.slug), tag_ids: selectedTags });
      const savedTagIds = saved.blog_tags?.map((tag) => tag.id) ?? [];
      setPost(saved); setSelectedTags(savedTagIds); setDirty(false);
      setSavedState(autosave ? 'Autosaved' : targetStatus === 'published' ? 'Article published' : targetStatus === 'scheduled' ? 'Post scheduled' : 'Draft saved');
      if (mode === 'new') navigate(`/blog/${saved.id}/edit`, { replace: true });
      return saved;
    } catch (err) {
      setSavedState(''); setError(err instanceof Error ? err.message : 'Could not save article. Check duplicate slugs or Supabase permissions.'); return null;
    } finally { setSaving(false); setSavingAction(null); }
  }

  async function publishOrUpdate() {
    const target: BlogStatus = post.status === 'scheduled' ? 'scheduled' : 'published';
    await handleSave(target);
  }

  async function archivePost() {
    if (!post.id) return;
    try { await updatePostStatus(post, 'archived'); setPost(await getPost(post.id)); setSavedState('Article archived'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not archive article.'); }
  }

  async function handleFeaturedImage(file: File) {
    setUploading(true); setError('');
    try {
      const uploaded = await uploadBlogImage(file, 'featured', post.id || 'draft');
      update('featured_image_url', uploaded.url); update('featured_image_path', uploaded.path);
      setSavedState('Image selected. Save the article to persist it.'); setModal(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'Image upload failed.'); }
    finally { setUploading(false); }
  }

  function selectMediaImage(item: BlogMediaItem) {
    update('featured_image_url', item.publicUrl); update('featured_image_path', item.path);
    setSavedState('Image selected. Save the article to persist it.'); setModal(null);
  }

  async function handleCreateCategory() {
    if (!newCategory.name.trim()) return;
    try {
      const category = await saveCategory({ name: newCategory.name.trim(), slug: newCategory.slug || slugify(newCategory.name), description: newCategory.description });
      setCategories(await listCategories()); update('category_id', category.id);
      setNewCategory({ name: '', slug: '', description: '' }); setModal(null); setSavedState('Category created');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not create category.'); }
  }

  async function handleCreateTag() {
    if (!newTag.trim()) return;
    try {
      const tag = await createTagByName(newTag.trim());
      setTags((current) => current.some((item) => item.id === tag.id) ? current : [...current, tag].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedTags((current) => current.includes(tag.id) ? current : [...current, tag.id]);
      setNewTag(''); setDirty(true); setSavedState('Tag added');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not create tag.'); }
  }

  async function moderateComment(commentId: string, status: CommentStatus) {
    try { await updateCommentStatus(commentId, status); setComments(await listComments('all')); setSavedState('Comment updated'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not update comment.'); }
  }

  async function removeComment(commentId: string) {

    try { await deleteComment(commentId); setComments(await listComments('all')); setSavedState('Comment deleted'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not delete comment.'); }
  }


  async function handleUpdateComment() {
    if (!editingComment || !editingComment.comment.trim()) return;
    try {
      await updateComment(editingComment.id, { name: editingComment.name.trim(), email: editingComment.email.trim(), comment: editingComment.comment.trim() });
      setComments(await listComments('all'));
      setEditingComment(null);
      setSavedState('Comment updated');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not edit comment.'); }
  }
  function handleBack() {
    if (dirty) {
      setConfirmDialog({ title: 'Leave with unsaved changes?', description: 'Your latest edits have not been saved yet.', actionLabel: 'Leave', onConfirm: async () => { navigate('/blog'); } });
      return;
    }
    navigate('/blog');
  }

  if (loading) return <div className="rounded-[10px] border border-admin-border bg-white p-8 text-sm font-bold text-admin-muted">Loading article...</div>;

  return (
    <div className="space-y-4">
      <header className="sticky top-0 z-20 -mx-4 -mt-5 flex h-16 items-center justify-between border-b border-admin-border bg-white/95 px-4 backdrop-blur md:-mx-6 md:px-6 xl:-mx-7 xl:px-7">
        <button type="button" onClick={handleBack} aria-label="Back to Blog" title="Back to Blog" className="grid size-10 place-items-center rounded-lg text-admin-dark hover:bg-admin-background hover:text-brand-500"><FiChevronLeft className="size-6" /></button>
        <div className="flex flex-wrap gap-2">
          {post.id ? <Link target="_blank" rel="noreferrer" to={`/blog/${post.id}/preview`} className="inline-flex h-10 items-center justify-center rounded-[10px] border border-admin-border bg-white px-4 text-sm font-bold text-admin-dark hover:bg-admin-background">Preview</Link> : <button type="button" disabled className="inline-flex h-10 items-center justify-center rounded-[10px] border border-admin-border bg-white px-4 text-sm font-bold text-admin-muted opacity-60">Preview</button>}
          <button type="button" disabled={saving || (!dirty && post.status === 'draft')} onClick={() => void handleSave('draft')} className="inline-flex h-10 items-center justify-center rounded-[10px] border border-admin-border bg-white px-4 text-sm font-bold text-admin-dark hover:bg-admin-background disabled:cursor-not-allowed disabled:opacity-50">{savingAction === 'draft' ? 'Saving Draft...' : post.id && post.status !== 'draft' ? 'Unpublish / Save Draft' : 'Save Draft'}</button>
          <button type="button" disabled={saving || (!dirty && post.status === 'published')} onClick={() => void publishOrUpdate()} className={`inline-flex h-10 items-center justify-center rounded-[10px] px-4 text-sm font-bold text-white disabled:cursor-not-allowed ${dirty || post.status !== 'published' ? 'bg-brand-500 hover:bg-brand-600' : 'bg-zinc-300 text-zinc-600'}`}>{savingAction === 'publish' ? 'Updating...' : publishLabel}</button>
        </div>
      </header>
      {error ? <p className="rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}
      {savedState ? <p className="rounded-[10px] border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">{savedState}</p> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem] 2xl:grid-cols-[minmax(0,1fr)_19rem]">
        <main className="min-w-0 bg-white">
          <div className="flex gap-6 border-b border-admin-border px-1 pt-1">
            {(Object.keys(tabLabels) as EditorTab[]).map((tab) => (
              <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`border-b-2 px-1 pb-4 text-sm font-extrabold ${activeTab === tab ? 'border-brand-500 text-brand-500' : 'border-transparent text-admin-muted hover:text-admin-dark'}`}>{tabLabels[tab]}</button>
            ))}
          </div>

          {activeTab === 'content' ? (
            <section className="space-y-3 py-4">
              <div><FieldLabel meta={`${post.title.length} / 120`}>Post Title</FieldLabel><input value={post.title} onChange={(event) => update('title', event.target.value)} placeholder="Article title" className="h-12 w-full rounded-[10px] border border-admin-border bg-white px-4 text-base font-bold outline-none focus:border-brand-500" /></div>
              <div><FieldLabel meta={`${(post.excerpt ?? '').length} / 200`}>Excerpt</FieldLabel><textarea value={post.excerpt ?? ''} onChange={(event) => update('excerpt', event.target.value)} rows={4} placeholder="Short article summary" className="w-full rounded-[10px] border border-admin-border bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-brand-500" /></div>
              <div>
                <FieldLabel>Featured Image</FieldLabel>
                <div className="relative overflow-hidden rounded-[10px] border border-admin-border bg-admin-background">
                  {post.featured_image_url ? <img src={post.featured_image_url} alt={post.featured_image_alt ?? ''} className="h-[200px] w-full object-cover" /> : <div className="grid h-[200px] place-items-center text-sm font-bold text-admin-muted"><FiImage className="mb-2 size-7" />No featured image selected</div>}
                  <div className="absolute bottom-3 left-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => setModal('media')} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-black/60 px-2.5 text-xs font-bold text-white backdrop-blur"><FiImage />Replace</button>
                    {post.featured_image_url ? <button type="button" onClick={() => { update('featured_image_url', ''); update('featured_image_path', ''); }} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-black/60 px-2.5 text-xs font-bold text-white backdrop-blur"><FiTrash2 />Remove</button> : null}
                  </div>
                </div>
              </div>
              <div>
                <FieldLabel>Article Content</FieldLabel>
                <RichTextEditor value={post.content ?? ''} onChange={(html) => update('content', html)} postId={post.id || 'draft'} />
                <div className="flex flex-col gap-2 border-x border-b border-admin-border bg-white px-4 py-3 text-xs font-bold text-admin-muted sm:flex-row sm:items-center sm:justify-between"><span>{dirty ? 'Unsaved changes' : post.updated_at ? `Saved ${formatDate(post.updated_at)}` : 'Not saved yet'}</span><span>Words: {words} - Characters: {characters.toLocaleString()}</span></div>
              </div>
            </section>
          ) : null}

          {activeTab === 'settings' ? (
            <section className="space-y-5 py-4">
              <div>
                <h2 className="text-sm font-extrabold uppercase tracking-wide text-admin-muted">Publishing</h2>
                <div className="mt-3 grid gap-4 lg:grid-cols-3">
                  <div><FieldLabel>Status</FieldLabel><select value={post.status} onChange={(event) => update('status', event.target.value as BlogStatus)} className="h-10 w-full rounded-[10px] border border-admin-border bg-white px-3 text-sm font-bold outline-none focus:border-brand-500"><option value="draft">Draft</option><option value="published">Published</option><option value="scheduled">Scheduled</option><option value="archived">Archived</option></select></div>
                  <div><FieldLabel>Visibility</FieldLabel><input value="Public" disabled className="h-10 w-full rounded-[10px] border border-admin-border bg-admin-background px-3 text-sm font-bold text-admin-muted" /></div>
                  <div><FieldLabel>Published Date</FieldLabel><input type="datetime-local" value={toInputDateTime(post.published_at)} onChange={(event) => update('published_at', fromInputDateTime(event.target.value))} className="h-10 w-full rounded-[10px] border border-admin-border px-3 text-sm outline-none focus:border-brand-500" /></div>
                  {post.status === 'scheduled' ? <div><FieldLabel>Schedule Date</FieldLabel><input type="datetime-local" value={toInputDateTime(post.scheduled_at)} onChange={(event) => update('scheduled_at', fromInputDateTime(event.target.value))} className="h-10 w-full rounded-[10px] border border-admin-border px-3 text-sm outline-none focus:border-brand-500" /></div> : null}
                </div>
              </div>
              <div className="border-t border-admin-border pt-5">
                <h2 className="text-sm font-extrabold uppercase tracking-wide text-admin-muted">Organization</h2>
                <div className="mt-3 grid gap-4 lg:grid-cols-2">
                  <div><FieldLabel>Author</FieldLabel><input value={post.author_name ?? ''} onChange={(event) => update('author_name', event.target.value)} className="h-10 w-full rounded-[10px] border border-admin-border px-3 text-sm outline-none focus:border-brand-500" /></div>
                  <div><FieldLabel>Category</FieldLabel><select value={post.category_id ?? ''} onChange={(event) => update('category_id', event.target.value || null)} className="h-10 w-full rounded-[10px] border border-admin-border bg-white px-3 text-sm outline-none focus:border-brand-500"><option value="">Uncategorized</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><button type="button" onClick={() => setModal('category')} className="mt-2 inline-flex items-center gap-1 text-sm font-extrabold text-brand-500"><FiPlus />Add New Category</button></div>
                  <div className="lg:col-span-2"><FieldLabel>Tags</FieldLabel><div className="flex flex-wrap gap-2">{selectedTagObjects.map((tag) => <button key={tag.id} type="button" onClick={() => { setSelectedTags((current) => current.filter((item) => item !== tag.id)); setDirty(true); }} className="inline-flex items-center gap-1 rounded-full bg-admin-background px-2.5 py-1 text-xs font-bold text-admin-dark">{tag.name}<FiX className="size-3" /></button>)}</div><div className="mt-3 flex max-w-md gap-2"><input value={newTag} onChange={(event) => setNewTag(event.target.value)} placeholder="Add a tag..." className="h-10 min-w-0 flex-1 rounded-[10px] border border-admin-border px-3 text-sm outline-none focus:border-brand-500" /><button type="button" onClick={() => void handleCreateTag()} className="rounded-[10px] bg-admin-dark px-4 text-sm font-bold text-white hover:bg-black">Add</button></div><div className="mt-3 flex flex-wrap gap-2">{tags.filter((tag) => !selectedTags.includes(tag.id)).slice(0, 8).map((tag) => <button key={tag.id} type="button" onClick={() => { setSelectedTags((current) => [...current, tag.id]); setDirty(true); }} className="rounded-full border border-admin-border px-2.5 py-1 text-xs font-bold text-admin-muted hover:border-brand-500 hover:text-brand-500">{tag.name}</button>)}</div></div>
                </div>
              </div>
              <div className="border-t border-admin-border pt-5">
                <h2 className="text-sm font-extrabold uppercase tracking-wide text-admin-muted">Interaction</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2"><ToggleSwitch label="Allow Comments" checked={post.allow_comments} onChange={(value) => update('allow_comments', value)} /><ToggleSwitch label="Featured Article" checked={post.is_featured} onChange={(value) => update('is_featured', value)} /></div>
              </div>
            </section>
          ) : null}
          {activeTab === 'seo' ? (
            <section className="space-y-5 py-4">
              <div>
                <h2 className="text-sm font-extrabold uppercase tracking-wide text-admin-muted">Search Appearance</h2>
                <div className="mt-3 space-y-4">
                  <div><FieldLabel meta={`${(post.seo_title ?? '').length} chars`} helper="Title shown in search results.">SEO Title</FieldLabel><input value={post.seo_title ?? ''} onChange={(event) => update('seo_title', event.target.value)} className="h-10 w-full rounded-[10px] border border-admin-border px-3 text-sm outline-none focus:border-brand-500" /></div>
                  <div><FieldLabel meta={`${(post.meta_description ?? '').length} / 160`} helper="Short summary that may appear below the title in search engines. Recommended: around 150-160 characters.">Meta Description</FieldLabel><textarea value={post.meta_description ?? ''} onChange={(event) => update('meta_description', event.target.value)} rows={4} className="w-full rounded-[10px] border border-admin-border px-3 py-2 text-sm leading-6 outline-none focus:border-brand-500" /></div>
                  <div><FieldLabel>URL Slug</FieldLabel><input value={post.slug} onChange={(event) => update('slug', slugify(event.target.value))} className="h-10 w-full rounded-[10px] border border-admin-border px-3 text-sm outline-none focus:border-brand-500" /></div>
                  <div className="rounded-[10px] border border-admin-border bg-admin-background p-4"><p className="text-xs font-extrabold uppercase tracking-wide text-brand-500">Search Preview</p><p className="mt-3 text-base font-bold text-blue-800">{seoTitle}</p><p className="text-xs font-semibold text-green-700">/blog/{post.slug || 'article-slug'}</p><p className="mt-2 max-w-3xl text-sm leading-6 text-admin-muted">{metaDescription || 'Meta description preview will appear here.'}</p></div>
                </div>
              </div>
              <div className="border-t border-admin-border pt-5">
                <h2 className="text-sm font-extrabold uppercase tracking-wide text-admin-muted">Keywords</h2>
                <div className="mt-3 grid gap-4 lg:grid-cols-2"><div><FieldLabel>Focus Keyword</FieldLabel><input value={post.focus_keyword ?? ''} onChange={(event) => update('focus_keyword', event.target.value)} placeholder="Uganda safari" className="h-10 w-full rounded-[10px] border border-admin-border px-3 text-sm outline-none focus:border-brand-500" /></div><div><FieldLabel>Additional Keywords</FieldLabel><input value={keywordText} onChange={(event) => update('seo_keywords', event.target.value.split(',').map((item) => item.trim()).filter(Boolean))} placeholder="safari, trekking, Uganda" className="h-10 w-full rounded-[10px] border border-admin-border px-3 text-sm outline-none focus:border-brand-500" /></div></div>
              </div>
              <div className="border-t border-admin-border pt-5">
                <h2 className="text-sm font-extrabold uppercase tracking-wide text-admin-muted">Advanced</h2>
                <div className="mt-3 grid gap-4 lg:grid-cols-2"><div><FieldLabel>Canonical URL</FieldLabel><input value={post.canonical_url ?? ''} onChange={(event) => update('canonical_url', event.target.value)} className="h-10 w-full rounded-[10px] border border-admin-border px-3 text-sm outline-none focus:border-brand-500" /></div><div><FieldLabel>Featured Image Alt Text</FieldLabel><input value={post.featured_image_alt ?? ''} onChange={(event) => update('featured_image_alt', event.target.value)} className="h-10 w-full rounded-[10px] border border-admin-border px-3 text-sm outline-none focus:border-brand-500" /></div></div>
              </div>
            </section>
          ) : null}
        </main>

        <aside className="h-fit border border-admin-border bg-white p-4 xl:sticky xl:top-28">
          <section>
            <h2 className="text-sm font-extrabold text-admin-dark">Publishing</h2>
            <dl className="mt-3 space-y-2.5 text-sm"><div className="flex justify-between gap-3"><dt className="font-semibold text-admin-muted">Status</dt><dd className="font-extrabold text-admin-dark">{statusLabels[post.status]}</dd></div><div className="flex justify-between gap-3"><dt className="font-semibold text-admin-muted">Category</dt><dd className="text-right font-extrabold text-admin-dark">{selectedCategory?.name ?? 'Uncategorized'}</dd></div><div className="flex justify-between gap-3"><dt className="font-semibold text-admin-muted">Publish date</dt><dd className="font-extrabold text-admin-dark">{formatDate(post.published_at || post.scheduled_at)}</dd></div></dl>
            {post.id ? <button type="button" onClick={() => setConfirmDialog({ title: 'Move article to trash?', description: 'This archives the article and removes it from the active workflow.', actionLabel: 'Move to Trash', onConfirm: archivePost })} className="mt-4 text-sm font-extrabold text-red-600 hover:text-red-700">Move to Trash</button> : null}
          </section>
          <section className="mt-5 border-t border-admin-border pt-5">
            <h2 className="text-sm font-extrabold text-admin-dark">Article Details</h2>
            <div className="mt-3 space-y-3 text-sm"><div><p className="font-bold text-admin-muted">Tags</p><div className="mt-2 flex flex-wrap gap-1.5">{selectedTagObjects.length ? selectedTagObjects.map((tag) => <span key={tag.id} className="rounded-full bg-admin-background px-2.5 py-1 text-xs font-bold text-admin-dark">{tag.name}</span>) : <span className="text-admin-muted">No tags selected</span>}</div></div><div className="flex items-center justify-between"><span className="font-bold text-admin-muted">Featured Image</span><span className="font-extrabold text-admin-dark">{post.featured_image_url ? 'Selected' : 'Missing'}</span></div><div><div className="flex items-center justify-between gap-3"><span className="font-bold text-admin-muted">Comments</span><span className="text-xs font-bold text-admin-muted">{relatedComments.length} total - {pendingComments} pending</span></div>{relatedComments.length ? <button type="button" onClick={() => setModal('comments')} className="mt-2 inline-flex items-center gap-1.5 text-xs font-extrabold text-brand-500 hover:text-brand-600"><FiMessageSquare />Manage Comments</button> : <p className="mt-1 text-xs font-semibold text-admin-muted">No comments for this article.</p>}</div></div>
          </section>
        </aside>
      </div>

      {confirmDialog ? <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={confirmDialog.title}><div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"><h2 className="text-lg font-bold">{confirmDialog.title}</h2><p className="mt-3 text-sm text-admin-muted">{confirmDialog.description}</p><div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => setConfirmDialog(null)}>Cancel</button><Button onClick={() => { const action = confirmDialog.onConfirm; setConfirmDialog(null); void action(); }}>{confirmDialog.actionLabel}</Button></div></div></div> : null}
      {modal === 'media' ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <section className="max-h-[86vh] w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-admin-border p-5"><div><h2 className="text-lg font-extrabold">Choose Featured Image</h2><p className="text-sm text-admin-muted">Upload a new image or choose one from the media library.</p></div><button type="button" onClick={() => setModal(null)} className="grid size-9 place-items-center rounded-[10px] border border-admin-border"><FiX /></button></div>
            <div className="grid gap-5 p-5 lg:grid-cols-[18rem_1fr]">
              <label className="grid min-h-52 cursor-pointer place-items-center rounded-[10px] border border-dashed border-admin-border bg-admin-background p-5 text-center"><input type="file" accept="image/jpeg,image/jpg,image/png,image/webp,image/avif" className="hidden" onChange={(event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (file) void handleFeaturedImage(file); }} /><span className="grid place-items-center text-sm font-bold text-admin-muted"><FiUploadCloud className="mb-3 size-8 text-brand-500" />{uploading ? 'Uploading...' : 'Upload Image'}</span></label>
              <div className="min-w-0"><div className="relative"><FiSearch className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-admin-muted" /><input value={mediaSearch} onChange={(event) => setMediaSearch(event.target.value)} placeholder="Search media..." className="h-10 w-full rounded-[10px] border border-admin-border pl-10 pr-3 text-sm" /></div><div className="mt-4 grid max-h-[48vh] grid-cols-2 gap-3 overflow-auto md:grid-cols-3">{filteredMedia.map((item) => <button key={item.path} type="button" onClick={() => selectMediaImage(item)} className="overflow-hidden rounded-[10px] border border-admin-border text-left hover:border-brand-500"><img src={item.publicUrl} alt={item.name} className="aspect-video w-full object-cover" /><span className="block truncate px-3 py-2 text-xs font-bold text-admin-dark">{item.name}</span></button>)}{filteredMedia.length === 0 ? <p className="col-span-full py-8 text-sm font-semibold text-admin-muted">No media found.</p> : null}</div></div>
            </div>
          </section>
        </div>
      ) : null}

      {modal === 'category' ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <section className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between"><h2 className="text-lg font-extrabold">Add New Category</h2><button type="button" onClick={() => setModal(null)} className="grid size-9 place-items-center rounded-[10px] border border-admin-border"><FiX /></button></div>
            <div className="mt-5 space-y-4"><div><FieldLabel>Name</FieldLabel><input value={newCategory.name} onChange={(event) => setNewCategory((current) => ({ ...current, name: event.target.value, slug: current.slug || slugify(event.target.value) }))} className="h-10 w-full rounded-[10px] border border-admin-border px-3 text-sm" /></div><div><FieldLabel>Slug</FieldLabel><input value={newCategory.slug} onChange={(event) => setNewCategory((current) => ({ ...current, slug: slugify(event.target.value) }))} className="h-10 w-full rounded-[10px] border border-admin-border px-3 text-sm" /></div><div><FieldLabel>Description</FieldLabel><textarea value={newCategory.description} onChange={(event) => setNewCategory((current) => ({ ...current, description: event.target.value }))} rows={3} className="w-full rounded-[10px] border border-admin-border px-3 py-2 text-sm" /></div><div className="flex justify-end gap-2"><button type="button" onClick={() => setModal(null)} className="h-10 rounded-[10px] border border-admin-border px-4 text-sm font-bold">Cancel</button><Button onClick={() => void handleCreateCategory()}>Create Category</Button></div></div>
          </section>
        </div>
      ) : null}

      {modal === 'comments' ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <section className="max-h-[86vh] w-full max-w-3xl overflow-auto rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between"><div><h2 className="text-lg font-extrabold">Manage Comments</h2><p className="mt-1 text-sm text-admin-muted">Comments for this article only.</p></div><button type="button" onClick={() => { setEditingComment(null); setModal(null); }} className="grid size-9 place-items-center rounded-[10px] border border-admin-border"><FiX /></button></div>
            <div className="mt-4 divide-y divide-admin-border">{relatedComments.map((comment) => {
              const isEditing = editingComment?.id === comment.id;
              return <article key={comment.id} className="py-4"><div className="flex flex-col gap-3"><div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between"><div><p className="text-sm font-extrabold text-admin-dark">{comment.name}</p><p className="mt-1 text-xs font-semibold text-admin-muted">{comment.email}</p></div><span className="w-fit rounded-full bg-admin-background px-2.5 py-1 text-xs font-bold capitalize text-admin-muted">{comment.status}</span></div>{isEditing ? <div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><input value={editingComment.name} onChange={(event) => setEditingComment((current) => current ? { ...current, name: event.target.value } : current)} className="h-10 rounded-[10px] border border-admin-border px-3 text-sm outline-none focus:border-brand-500" /><input value={editingComment.email} onChange={(event) => setEditingComment((current) => current ? { ...current, email: event.target.value } : current)} className="h-10 rounded-[10px] border border-admin-border px-3 text-sm outline-none focus:border-brand-500" /></div><textarea value={editingComment.comment} onChange={(event) => setEditingComment((current) => current ? { ...current, comment: event.target.value } : current)} rows={4} className="w-full rounded-[10px] border border-admin-border px-3 py-2 text-sm leading-6 outline-none focus:border-brand-500" /><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void handleUpdateComment()} className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-bold text-white">Save Comment</button><button type="button" onClick={() => setEditingComment(null)} className="rounded-lg border border-admin-border px-3 py-1.5 text-xs font-bold">Cancel</button></div></div> : <p className="text-sm leading-6 text-admin-muted">{comment.comment}</p>}<div className="flex flex-wrap gap-2">{comment.status === 'approved' ? <span className="rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700">Approved</span> : <button type="button" onClick={() => void moderateComment(comment.id, 'approved')} className="rounded-lg border border-green-200 px-3 py-1.5 text-xs font-bold text-green-700">Approve</button>}<button type="button" onClick={() => setEditingComment({ id: comment.id, name: comment.name, email: comment.email, comment: comment.comment })} className="inline-flex items-center gap-1.5 rounded-lg border border-admin-border px-3 py-1.5 text-xs font-bold"><FiEdit3 />Edit</button><button type="button" onClick={() => void moderateComment(comment.id, 'rejected')} className="rounded-lg border border-admin-border px-3 py-1.5 text-xs font-bold">Reject</button><button type="button" onClick={() => void moderateComment(comment.id, 'spam')} className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-bold text-amber-700">Spam</button><button type="button" onClick={() => setConfirmDialog({ title: 'Delete comment?', description: 'This comment will be permanently removed.', actionLabel: 'Delete', onConfirm: () => removeComment(comment.id) })} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600">Delete</button></div></div></article>;
            })}{relatedComments.length === 0 ? <p className="py-8 text-sm font-semibold text-admin-muted">No comments for this article.</p> : null}</div>
          </section>
        </div>
      ) : null}
    </div>
  );
}













