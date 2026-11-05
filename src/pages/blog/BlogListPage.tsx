import { useEffect, useMemo, useRef, useState } from 'react';
import { FiArchive, FiCalendar, FiCheckCircle, FiCopy, FiEdit3, FiEye, FiFileText, FiMessageSquare, FiMoreVertical, FiPlus, FiSearch, FiTrash2, FiX } from 'react-icons/fi';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { Button, EmptyState } from '../../components/blog/BlogUI';
import { deletePost, duplicatePost, listCategories, listComments, listPosts, updatePostStatus } from '../../lib/blogService';
import type { BlogCategory, BlogComment, BlogPost, BlogStatus } from '../../types/blog';
import { formatDate } from '../../utils/blog';
import { CategoriesPage } from '../categories/CategoriesPage';
import { TagsPage } from '../tags/TagsPage';
import { MediaPage } from '../media/MediaPage';
import { CommentsPage } from '../comments/CommentsPage';

const blogPanels = {
  categories: { label: 'Categories', component: CategoriesPage },
  tags: { label: 'Tags', component: TagsPage },
  media: { label: 'Media', component: MediaPage },
  comments: { label: 'Comments', component: CommentsPage },
};

type PostFilter = BlogStatus | 'all';

type StatCardProps = {
  icon: typeof FiFileText;
  label: string;
  value: number;
  tone: string;
  onClick?: () => void;
};

const statusClasses: Record<BlogStatus, string> = {
  published: 'bg-green-50 text-green-700 ring-green-100',
  draft: 'bg-blue-50 text-blue-700 ring-blue-100',
  scheduled: 'bg-amber-50 text-brand-500 ring-amber-100',
  archived: 'bg-zinc-100 text-zinc-600 ring-zinc-200',
};

const statusLabels: Record<BlogStatus, string> = {
  published: 'Published',
  draft: 'Draft',
  scheduled: 'Scheduled',
  archived: 'Archived',
};

function StatCard({ icon: Icon, label, value, tone, onClick }: StatCardProps) {
  const content = <><div className={`grid size-10 shrink-0 place-items-center rounded-lg ${tone}`}><Icon className="size-5" /></div><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-admin-muted">{label}</p><p className="mt-0.5 text-2xl font-extrabold text-admin-dark">{value}</p></div></>;
  if (onClick) return <button type="button" onClick={onClick} className="flex items-center gap-3 border-b border-admin-border p-4 text-left transition hover:bg-admin-background/70 last:border-b-0 sm:odd:border-r xl:border-b-0 xl:border-r xl:last:border-r-0 sm:[&:nth-child(4)]:border-r-0 xl:[&:nth-child(4)]:border-r">{content}</button>;
  return <article className="flex items-center gap-3 border-b border-admin-border p-4 last:border-b-0 sm:odd:border-r xl:border-b-0 xl:border-r xl:last:border-r-0 sm:[&:nth-child(4)]:border-r-0 xl:[&:nth-child(4)]:border-r">{content}</article>;
}

function StatusBadge({ status }: { status: BlogStatus }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold ring-1 ${statusClasses[status]}`}>{statusLabels[status]}</span>;
}

function getUpdatedDate(post: BlogPost) {
  return formatDate(post.updated_at || post.published_at || post.created_at);
}

export function BlogListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [comments, setComments] = useState<BlogComment[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<PostFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState(1);
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; actionLabel: string; onConfirm: () => Promise<void> } | null>(null);
  const panelName = searchParams.get('panel');
  const activePanel = panelName && Object.hasOwn(blogPanels, panelName) ? blogPanels[panelName as keyof typeof blogPanels] : null;
  const PanelContent = activePanel?.component;
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (panelName && panelRef.current) {
      panelRef.current.focus({ preventScroll: true });
      panelRef.current.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
  }, [panelName]);

  async function refresh() {
    setError('');
    const [postData, categoryData, commentData] = await Promise.all([
      listPosts({ sort: 'updated' }),
      listCategories(),
      listComments('all'),
    ]);
    setPosts(postData);
    setSelectedPostIds(current => current.filter(id => postData.some(post => post.id === id)));
    setCategories(categoryData);
    setComments(commentData);
  }

  useEffect(() => {
    async function load() {
      try { await refresh(); }
      catch (err) { setError(err instanceof Error ? err.message : 'Could not load blog posts.'); }
      finally { setLoading(false); }
    }
    void load();
  }, []);


  const counts = useMemo(() => ({
    all: posts.length,
    published: posts.filter((post) => post.status === 'published').length,
    draft: posts.filter((post) => post.status === 'draft').length,
    scheduled: posts.filter((post) => post.status === 'scheduled').length,
    pendingComments: comments.filter((comment) => comment.status === 'pending').length,
  }), [posts, comments]);

  const filteredPosts = useMemo(() => posts
    .filter((post) => filter === 'all' ? true : post.status === filter)
    .filter((post) => {
      const haystack = [post.title, post.excerpt, post.author_name, post.blog_categories?.name].join(' ').toLowerCase();
      return haystack.includes(search.toLowerCase());
    }), [posts, search, filter]);

  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(filteredPosts.length / pageSize));
  const visiblePosts = filteredPosts.slice((page - 1) * pageSize, page * pageSize);
  const selectedPosts = posts.filter((post) => selectedPostIds.includes(post.id));
  const allVisibleSelected = visiblePosts.length > 0 && visiblePosts.every((post) => selectedPostIds.includes(post.id));

  function togglePostSelection(id: string) {
    setSelectedPostIds((current) => current.includes(id) ? current.filter((postId) => postId !== id) : [...current, id]);
  }

  function toggleVisibleSelection() {
    setSelectedPostIds((current) => {
      const visibleIds = visiblePosts.map((post) => post.id);
      if (visibleIds.every((id) => current.includes(id))) return current.filter((id) => !visibleIds.includes(id));
      return Array.from(new Set([...current, ...visibleIds]));
    });
  }

  async function archivePost(post: BlogPost) {
    try { await updatePostStatus(post, 'archived'); await refresh(); setNotice('Post archived.'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not archive post.'); }
  }

  async function copyPost(post: BlogPost) {
    try {
      const copy = await duplicatePost(post);
      await refresh();
      setNotice('Post duplicated.');
      navigate(`/blog/${copy.id}/edit`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not duplicate post.'); }
  }

  async function duplicateSelectedPosts() {
    if (!selectedPosts.length) return;
    try {
      await Promise.all(selectedPosts.map((post) => duplicatePost(post)));
      await refresh();
      setSelectedPostIds([]);
      setNotice(`${selectedPosts.length} ${selectedPosts.length === 1 ? 'post' : 'posts'} duplicated.`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not duplicate selected posts.'); }
  }

  async function removePost(post: BlogPost) {
    try { await deletePost(post.id); await refresh(); setNotice('Post deleted.'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not delete post.'); }
  }

  async function removeSelectedPosts() {
    if (!selectedPosts.length) return;
    try {
      await Promise.all(selectedPosts.map((post) => deletePost(post.id)));
      await refresh();
      setSelectedPostIds([]);
      setNotice(`${selectedPosts.length} ${selectedPosts.length === 1 ? 'post' : 'posts'} deleted.`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not delete selected posts.'); }
  }

  function closePanel() {
    setSearchParams({});
    void refresh().catch(err => setError(err instanceof Error ? err.message : 'Could not refresh blog.'));
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-admin-border pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-admin-dark">Blog</h1>
          <p className="mt-2 text-sm font-medium text-admin-muted">Create and manage your website articles.</p>
        </div>
        <div className="flex items-center gap-3">
          <details className="relative">
            <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-[10px] border border-admin-border bg-white px-3 text-sm font-bold text-admin-dark" aria-label="Manage blog"><FiMoreVertical />Manage</summary>
            <div className="absolute right-0 z-20 mt-2 w-44 rounded-lg border border-admin-border bg-white p-1 shadow-xl">
              {Object.entries(blogPanels).map(([name, panel]) => <button key={name} type="button" className="block w-full rounded-lg px-3 py-2 text-left text-sm font-bold hover:bg-admin-background" onClick={event => { event.currentTarget.closest('details')?.removeAttribute('open'); setSearchParams({ panel: name }); }}>{panel.label}</button>)}
            </div>
          </details>
          <Link to="/blog/new"><Button className="gap-2"><FiPlus className="size-4" />New Post</Button></Link>
        </div>
      </header>

      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}
      {notice ? <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">{notice}</p> : null}

      <section className="grid overflow-hidden rounded-lg border border-admin-border bg-white sm:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={FiFileText} label="Total Posts" value={counts.all} tone="bg-[#F0FAF2] text-brand-500" />
        <StatCard icon={FiCheckCircle} label="Published" value={counts.published} tone="bg-green-50 text-green-700" />
        <StatCard icon={FiEdit3} label="Drafts" value={counts.draft} tone="bg-blue-50 text-blue-700" />
        <StatCard icon={FiCalendar} label="Scheduled" value={counts.scheduled} tone="bg-amber-50 text-brand-500" />
        <StatCard icon={FiMessageSquare} label="Pending Comments" value={counts.pendingComments} tone="bg-amber-50 text-amber-700" onClick={() => setSearchParams({ panel: 'comments' })} />
      </section>

      <section className="rounded-lg border border-admin-border bg-white">
        <div className="flex flex-col gap-3 border-b border-admin-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1 lg:max-w-xl">
            <FiSearch className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-admin-muted" />
            <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search posts..." className="h-10 w-full rounded-lg border border-admin-border bg-white pl-11 pr-4 text-sm outline-none focus:border-brand-500" />
          </div>
          <select value={filter} onChange={(event) => { setFilter(event.target.value as PostFilter); setPage(1); }} className="h-10 rounded-lg border border-admin-border bg-white px-3 text-sm font-bold text-admin-dark outline-none focus:border-brand-500">
            <option value="all">All Posts</option>
            <option value="published">Published</option>
            <option value="draft">Drafts</option>
            <option value="scheduled">Scheduled</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {selectedPostIds.length ? <div className="flex flex-col gap-3 border-b border-admin-border bg-[#fffaf7] px-5 py-3 text-sm font-bold text-admin-dark sm:flex-row sm:items-center sm:justify-between"><span>{selectedPostIds.length} selected</span><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void duplicateSelectedPosts()} className="inline-flex h-9 items-center gap-2 rounded-lg border border-admin-border bg-white px-3 text-sm font-bold hover:bg-admin-background"><FiCopy className="size-4" />Duplicate</button><button type="button" onClick={() => setConfirmDialog({ title: 'Delete selected articles permanently?', description: `This will permanently delete ${selectedPostIds.length} selected ${selectedPostIds.length === 1 ? 'article' : 'articles'} from Supabase. This cannot be undone.`, actionLabel: 'Delete selected', onConfirm: removeSelectedPosts })} className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-sm font-bold text-red-600 hover:bg-red-50"><FiTrash2 className="size-4" />Delete</button><button type="button" onClick={() => setSelectedPostIds([])} className="h-9 rounded-lg border border-admin-border bg-white px-3 text-sm font-bold hover:bg-admin-background">Clear</button></div></div> : null}

        {loading ? <div className="p-8 text-sm font-bold text-admin-muted">Loading posts...</div> : null}
        {!loading && visiblePosts.length === 0 ? <div className="p-5"><EmptyState title="No blog posts yet." description="Create your first article to get started." /><div className="mt-4 flex justify-center"><Link to="/blog/new"><Button>Create Post</Button></Link></div></div> : null}

        {!loading && visiblePosts.length > 0 ? (
          <div>
            <div className="hidden grid-cols-[36px_minmax(320px,1.6fr)_minmax(130px,0.7fr)_120px_120px_52px] gap-4 border-b border-admin-border px-5 py-3 text-xs font-extrabold uppercase tracking-wide text-admin-muted lg:grid">
              <span><input type="checkbox" checked={allVisibleSelected} onChange={toggleVisibleSelection} aria-label="Select all visible posts" className="size-4 accent-brand-500" /></span><span>Article</span><span>Category</span><span>Status</span><span>Updated</span><span>Actions</span>
            </div>
            <div className="divide-y divide-admin-border">
              {visiblePosts.map((post) => {
                const category = categories.find((cat) => cat.id === post.category_id) ?? post.blog_categories ?? null;
                const selected = selectedPostIds.includes(post.id);
                return (
                  <article key={post.id} onClick={() => navigate(`/blog/${post.id}/edit`)} className={`grid cursor-pointer gap-4 p-4 transition hover:bg-admin-background/60 lg:grid-cols-[36px_minmax(320px,1.6fr)_minmax(130px,0.7fr)_120px_120px_52px] lg:items-center lg:px-5 ${selected ? 'bg-[#F0FAF2]' : ''}`}>
                    <div onClick={(event) => event.stopPropagation()} className="flex items-center">
                      <input type="checkbox" checked={selected} onChange={() => togglePostSelection(post.id)} aria-label={`Select ${post.title || 'Untitled article'}`} className="size-4 accent-brand-500" />
                    </div>
                    <div className="flex min-w-0 gap-3">
                      <div className="h-12 w-[72px] shrink-0 overflow-hidden rounded-lg bg-admin-background">
                        {post.featured_image_url ? <img src={post.featured_image_url} alt={post.featured_image_alt ?? ''} className="size-full object-cover" /> : <div className="grid size-full place-items-center text-admin-muted"><FiFileText className="size-5" /></div>}
                      </div>
                      <div className="min-w-0">
                        <h2 className="line-clamp-2 text-sm font-extrabold text-admin-dark hover:text-brand-500">{post.title || 'Untitled article'}</h2>
                        <p className="mt-1 text-xs font-medium text-admin-muted">{post.author_name || 'Top Cloud Rwenzori Adventures Team'} · {formatDate(post.published_at || post.created_at)}</p>
                      </div>
                    </div>
                    <div className="text-sm font-bold text-admin-dark">{category?.name ?? 'Uncategorized'}</div>
                    <div><StatusBadge status={post.status} /></div>
                    <div className="text-sm font-semibold text-admin-muted">{getUpdatedDate(post)}</div>
                    <div className="flex items-center justify-end" onClick={(event) => event.stopPropagation()}>
                      <details className="relative">
                        <summary className="grid size-9 cursor-pointer list-none place-items-center rounded-lg border border-admin-border bg-white text-admin-dark hover:bg-admin-background"><FiMoreVertical /></summary>
                        <div className="absolute right-0 z-20 mt-2 w-40 rounded-lg border border-admin-border bg-white p-1 shadow-xl">
                          <Link to={`/blog/${post.id}/preview`} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold hover:bg-admin-background"><FiEye />Preview</Link>
                          <button type="button" onClick={() => void copyPost(post)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold hover:bg-admin-background"><FiCopy />Duplicate</button>
                          <button type="button" onClick={() => setConfirmDialog({ title: 'Archive article?', description: 'This moves the article out of the active publishing workflow.', actionLabel: 'Archive', onConfirm: () => archivePost(post) })} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold hover:bg-admin-background"><FiArchive />Archive</button>
                          <button type="button" onClick={() => setConfirmDialog({ title: 'Delete article permanently?', description: 'This cannot be undone. The article will be removed from Supabase.', actionLabel: 'Delete', onConfirm: () => removePost(post) })} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold text-red-600 hover:bg-red-50"><FiTrash2 />Delete</button>
                        </div>
                      </details>
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="flex flex-col gap-3 border-t border-admin-border px-5 py-4 text-sm font-semibold text-admin-muted sm:flex-row sm:items-center sm:justify-between">
              <span>Showing {visiblePosts.length ? (page - 1) * pageSize + 1 : 0} to {Math.min(page * pageSize, filteredPosts.length)} of {filteredPosts.length} posts</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} className="h-9 rounded-lg border border-admin-border px-3 disabled:opacity-40">Previous</button>
                {Array.from({ length: pageCount }).slice(0, 5).map((_, index) => <button key={index} type="button" onClick={() => setPage(index + 1)} className={`size-9 rounded-lg text-sm font-extrabold ${page === index + 1 ? 'bg-brand-500 text-white' : 'border border-admin-border text-admin-dark'}`}>{index + 1}</button>)}
                <button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page === pageCount} className="h-9 rounded-lg border border-admin-border px-3 disabled:opacity-40">Next</button>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {activePanel && PanelContent ? (
        <section ref={panelRef} tabIndex={-1} className="scroll-mt-5 rounded-lg border border-admin-border bg-white p-4 outline-none sm:p-5" aria-label={`Blog ${activePanel.label}`}>
          <div className="mb-5 flex items-center justify-between gap-3 border-b border-admin-border pb-4">
            <h2 className="font-bold text-admin-dark">Blog / {activePanel.label}</h2>
            <button type="button" onClick={closePanel} className="inline-flex items-center gap-2 rounded-lg border border-admin-border px-3 py-2 text-sm font-bold"><FiX />Close</button>
          </div>
          <PanelContent key={panelName} />
        </section>
      ) : null}

      {confirmDialog ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4"><div className="w-full max-w-md rounded-xl border border-admin-border bg-white p-5 shadow-xl"><h2 className="text-lg font-extrabold text-admin-dark">{confirmDialog.title}</h2><p className="mt-2 text-sm leading-6 text-admin-muted">{confirmDialog.description}</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setConfirmDialog(null)} className="rounded-lg border border-admin-border px-4 py-2 text-sm font-bold">Cancel</button><button type="button" onClick={() => { const action = confirmDialog.onConfirm; setConfirmDialog(null); void action(); }} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700">{confirmDialog.actionLabel}</button></div></div></div> : null}
    </div>
  );
}
