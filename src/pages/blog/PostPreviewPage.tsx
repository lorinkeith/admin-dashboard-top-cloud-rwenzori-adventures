import { sanitizeBlogHtml } from '../../utils/sanitizeBlogHtml';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Button, PageHeader } from '../../components/blog/BlogUI';
import { getPost } from '../../lib/blogService';
import type { BlogPost } from '../../types/blog';
import { formatDate, getReadTime } from '../../utils/blog';

export function PostPreviewPage() {
  const { id } = useParams();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    getPost(id).then(setPost).catch((err) => setError(err instanceof Error ? err.message : 'Could not load preview.'));
  }, [id]);

  if (error) return <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>;
  if (!post) return <p className="rounded-lg border border-admin-border bg-white p-8 text-sm font-bold text-admin-muted">Loading preview...</p>;

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Protected Preview" title={post.title} description="This draft/admin preview is only available inside the protected dashboard." action={<Link to={`/blog/${post.id}/edit`}><Button>Edit Post</Button></Link>} />
      <article className="overflow-hidden rounded-3xl border border-admin-border bg-white shadow-sm">
        {post.featured_image_url ? <img src={post.featured_image_url} alt={post.featured_image_alt ?? ''} className="max-h-[520px] w-full object-cover" /> : null}
        <div className="mx-auto max-w-3xl px-5 py-10 md:px-8">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-500">{post.blog_categories?.name ?? 'Uncategorized'}</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-admin-dark">{post.title}</h1>
          <p className="mt-4 text-sm font-semibold text-admin-muted">{post.author_name ?? 'Top Cloud Rwenzori Adventures Team'} · {formatDate(post.published_at ?? post.scheduled_at ?? post.updated_at)} · {getReadTime(post.content)} min read</p>
          {post.excerpt ? <p className="mt-6 text-lg leading-8 text-admin-muted">{post.excerpt}</p> : null}
          <div className="admin-article-body mt-8 text-base leading-8 text-admin-dark" dangerouslySetInnerHTML={{ __html: sanitizeBlogHtml(post.content) }} />
        </div>
      </article>
    </div>
  );
}

