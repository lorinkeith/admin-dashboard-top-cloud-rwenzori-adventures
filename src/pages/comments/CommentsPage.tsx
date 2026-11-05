import { useEffect, useState } from 'react';

import { PageHeader } from '../../components/blog/BlogUI';
import { deleteComment, listComments, updateCommentStatus } from '../../lib/blogService';
import type { BlogComment, CommentStatus } from '../../types/blog';
import { formatDate } from '../../utils/blog';

export function CommentsPage() {
  const [comments, setComments] = useState<BlogComment[]>([]);
  const [status, setStatus] = useState<CommentStatus | 'all'>('pending');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() { setComments(await listComments(status)); }
  useEffect(() => { void listComments(status).then(setComments).catch((err) => setError(err.message)); }, [status]);
  async function action(label: string, run: () => Promise<void>) { setError(''); setMessage(''); try { await run(); setMessage(label); await load(); } catch (err) { setError(err instanceof Error ? err.message : 'Action failed.'); } }

  return <div className="space-y-8"><PageHeader eyebrow="Comments" title="Moderate Comments" description="Review public comments before they appear on the Top Cloud Rwenzori Adventures blog." />{error ? <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p> : null}{message ? <p className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-700">{message}</p> : null}<div className="rounded-2xl border border-admin-border bg-white p-4"><select value={status} onChange={(e) => setStatus(e.target.value as CommentStatus | 'all')} className="h-11 rounded-xl border border-admin-border px-3 text-sm"><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="spam">Spam</option><option value="all">All</option></select></div><section className="space-y-4">{comments.length ? comments.map((comment) => <article key={comment.id} className="rounded-2xl border border-admin-border bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><p className="font-extrabold text-admin-dark">{comment.name}</p><p className="mt-1 text-sm text-admin-muted">{comment.email} · {formatDate(comment.created_at)} · {comment.blog_posts?.title ?? 'Deleted post'}</p><p className="mt-4 leading-7 text-admin-dark">{comment.comment}</p></div><span className="w-fit rounded-full bg-admin-background px-3 py-1 text-xs font-bold text-admin-muted">{comment.status}</span></div><div className="mt-5 flex flex-wrap gap-2"><button onClick={() => void action('Comment approved.', () => updateCommentStatus(comment.id, 'approved'))} className="rounded-lg border border-green-200 px-3 py-1.5 text-sm font-bold text-green-700">Approve</button><button onClick={() => void action('Comment rejected.', () => updateCommentStatus(comment.id, 'rejected'))} className="rounded-lg border border-admin-border px-3 py-1.5 text-sm font-bold">Reject</button><button onClick={() => void action('Comment marked as spam.', () => updateCommentStatus(comment.id, 'spam'))} className="rounded-lg border border-amber-200 px-3 py-1.5 text-sm font-bold text-amber-700">Spam</button><button onClick={() => { if (window.confirm('Delete this comment?')) void action('Comment deleted.', () => deleteComment(comment.id)); }} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-bold text-red-700">Delete</button></div></article>) : <p className="rounded-2xl border border-admin-border bg-white p-8 text-sm text-admin-muted">No comments found.</p>}</section></div>;
}
