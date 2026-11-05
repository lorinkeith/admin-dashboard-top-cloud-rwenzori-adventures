import { supabase as configuredClient } from './supabaseClient';
function client() { if (!configuredClient) throw new Error('Supabase is not configured. Set the existing Top Cloud environment variables.'); return configuredClient; }
import type { BlogCategory, BlogComment, BlogMediaItem, BlogPost, BlogStatus, BlogTag, CommentStatus } from '../types/blog';
import { slugify } from '../utils/blog';

export type PostListFilters = {
  search?: string;
  status?: BlogStatus | 'all';
  categoryId?: string;
  sort?: 'newest' | 'oldest' | 'updated' | 'title';
};

export type PostUpsertInput = Omit<BlogPost, 'created_at' | 'updated_at' | 'blog_categories' | 'blog_tags'> & { tag_ids: string[] };

const postListFields = 'id,title,slug,excerpt,featured_image_url,featured_image_alt,category_id,author_id,author_name,status,is_featured,allow_comments,published_at,scheduled_at,created_at,updated_at,blog_categories(id,name,slug,description,created_at,updated_at)';
const postFullFields = 'id,title,slug,excerpt,content,featured_image_url,featured_image_path,featured_image_alt,category_id,author_id,author_name,status,seo_title,meta_description,focus_keyword,seo_keywords,canonical_url,is_featured,allow_comments,published_at,scheduled_at,created_at,updated_at,blog_categories(id,name,slug,description,created_at,updated_at)';

export async function listCategories() {
  const { data, error } = await client().from('blog_categories').select('*').order('name');
  if (error) throw error;
  return (data ?? []) as BlogCategory[];
}

export async function saveCategory(input: Partial<BlogCategory> & { name: string }) {
  const payload = { name: input.name, slug: input.slug || slugify(input.name), description: input.description ?? null };
  const query = input.id
    ? client().from('blog_categories').update(payload).eq('id', input.id).select('*').single()
    : client().from('blog_categories').insert(payload).select('*').single();
  const { data, error } = await query;
  if (error) throw error;
  return data as BlogCategory;
}

export async function deleteCategory(id: string) {
  const { count, error: countError } = await client().from('blog_posts').select('*', { count: 'exact', head: true }).eq('category_id', id);
  if (countError) throw countError;
  if ((count ?? 0) > 0) throw new Error('This category is assigned to posts. Reassign those posts before deleting it.');
  const { error } = await client().from('blog_categories').delete().eq('id', id);
  if (error) throw error;
}

export async function listTags() {
  const { data, error } = await client().from('blog_tags').select('*').order('name');
  if (error) throw error;
  return (data ?? []) as BlogTag[];
}

export async function saveTag(input: Partial<BlogTag> & { name: string }) {
  const payload = { name: input.name, slug: input.slug || slugify(input.name) };
  const query = input.id
    ? client().from('blog_tags').update(payload).eq('id', input.id).select('*').single()
    : client().from('blog_tags').insert(payload).select('*').single();
  const { data, error } = await query;
  if (error) throw error;
  return data as BlogTag;
}

export async function deleteTag(id: string) {
  const { error } = await client().from('blog_tags').delete().eq('id', id);
  if (error) throw error;
}

export async function createTagByName(name: string) {
  const slug = slugify(name);
  const existing = await client().from('blog_tags').select('*').eq('slug', slug).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data as BlogTag;
  return saveTag({ name, slug });
}

function normalizePost<T extends Record<string, unknown>>(post: T) {
  const category = post.blog_categories;
  return { ...post, blog_categories: Array.isArray(category) ? category[0] ?? null : category ?? null } as unknown as BlogPost;
}

function normalizeComment<T extends Record<string, unknown>>(comment: T) {
  const post = comment.blog_posts;
  return { ...comment, blog_posts: Array.isArray(post) ? post[0] ?? null : post ?? null } as unknown as BlogComment;
}

export async function listPosts(filters: PostListFilters = {}) {
  let query = client().from('blog_posts').select(postListFields).limit(100);
  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);
  if (filters.categoryId) query = query.eq('category_id', filters.categoryId);
  if (filters.search) query = query.ilike('title', `%${filters.search.replace(/[%_]/g, '')}%`);

  if (filters.sort === 'oldest') query = query.order('created_at', { ascending: true });
  else if (filters.sort === 'title') query = query.order('title', { ascending: true });
  else if (filters.sort === 'updated') query = query.order('updated_at', { ascending: false });
  else query = query.order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map(normalizePost);
}

export async function getPost(id: string) {
  const { data, error } = await client().from('blog_posts').select(postFullFields).eq('id', id).single();
  if (error) throw error;
  const tags = await getPostTags(id);
  return { ...normalizePost(data as Record<string, unknown>), blog_tags: tags };
}

export async function getPostTags(postId: string) {
  const { data, error } = await client().from('blog_post_tags').select('blog_tags(id,name,slug,created_at)').eq('post_id', postId);
  if (error) throw error;
  return ((data ?? []) as Array<{ blog_tags: BlogTag | BlogTag[] | null }>).flatMap((row) => Array.isArray(row.blog_tags) ? row.blog_tags : row.blog_tags ? [row.blog_tags] : []);
}

export async function savePost(input: PostUpsertInput) {
  const { tag_ids, id } = input;
  const payload = {
    title: input.title,
    slug: input.slug,
    excerpt: input.excerpt,
    content: input.content,
    featured_image_url: input.featured_image_url,
    featured_image_path: input.featured_image_path,
    featured_image_alt: input.featured_image_alt,
    category_id: input.category_id,
    author_id: input.author_id,
    author_name: input.author_name,
    status: input.status,
    seo_title: input.seo_title,
    meta_description: input.meta_description,
    focus_keyword: input.focus_keyword,
    seo_keywords: input.seo_keywords,
    canonical_url: input.canonical_url,
    is_featured: input.is_featured,
    allow_comments: input.allow_comments,
    published_at: input.status === 'published' ? input.published_at ?? new Date().toISOString() : input.published_at,
    scheduled_at: input.status === 'scheduled' ? input.scheduled_at : null,
  };

  const query = id
    ? client().from('blog_posts').update(payload).eq('id', id).select(postFullFields).single()
    : client().from('blog_posts').insert(payload).select(postFullFields).single();
  const { data, error } = await query;
  if (error) throw error;

  const { error: deleteTagError } = await client().from('blog_post_tags').delete().eq('post_id', data.id);
  if (deleteTagError) throw deleteTagError;

  if (tag_ids.length) {
    const { error: tagError } = await client().from('blog_post_tags').insert(tag_ids.map((tagId) => ({ post_id: data.id, tag_id: tagId })));
    if (tagError) throw tagError;
  }

  return getPost(data.id);
}

export async function updatePostStatus(post: BlogPost, status: BlogStatus) {
  const payload: Partial<BlogPost> = { status };
  if (status === 'published' && !post.published_at) payload.published_at = new Date().toISOString();
  if (status !== 'scheduled') payload.scheduled_at = null;
  const { error } = await client().from('blog_posts').update(payload).eq('id', post.id);
  if (error) throw error;
}

export async function deletePost(id: string) {
  const { error } = await client().from('blog_posts').delete().eq('id', id);
  if (error) throw error;
}

export async function duplicatePost(post: BlogPost) {
  const source = await getPost(post.id);
  const duplicateSlug = `${source.slug}-${Date.now().toString().slice(-5)}`;
  const tags = source.blog_tags ?? await getPostTags(source.id);

  return savePost({
    ...source,
    id: '',
    title: `${source.title} Copy`,
    slug: duplicateSlug,
    status: 'draft',
    published_at: null,
    scheduled_at: null,
    tag_ids: tags.map((tag) => tag.id),
  });
}

export async function uploadBlogImage(file: File, folder: 'featured' | 'content', postId: string) {
  if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)) throw new Error('Use a JPG, PNG, WEBP, or AVIF image.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Image must be 5MB or smaller.');
  const extension = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${folder}/${postId || 'draft'}/${Date.now()}-${slugify(file.name.replace(/\.[^.]+$/, ''))}.${extension}`;
  const { error } = await client().storage.from('blog-images').upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  const { data } = client().storage.from('blog-images').getPublicUrl(path);
  return { path, url: data.publicUrl };
}

export async function listMedia() {
  const roots = ['featured', 'content'];
  const results: BlogMediaItem[] = [];

  async function collect(prefix: string) {
    const { data, error } = await client().storage.from('blog-images').list(prefix, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
    if (error) throw error;
    for (const item of data ?? []) {
      const path = `${prefix}/${item.name}`;
      if (!item.metadata || Object.keys(item.metadata).length === 0) {
        await collect(path);
      } else {
        const { data: publicData } = client().storage.from('blog-images').getPublicUrl(path);
        results.push({ ...item, path, publicUrl: publicData.publicUrl });
      }
    }
  }

  for (const root of roots) await collect(root);
  return results;
}

export async function deleteMedia(path: string) {
  const { error } = await client().storage.from('blog-images').remove([path]);
  if (error) throw error;
}

export async function listComments(status: CommentStatus | 'all' = 'pending') {
  let query = client().from('blog_comments').select('id,post_id,name,email,comment,status,created_at,blog_posts(id,title,slug)').order('created_at', { ascending: false }).limit(100);
  if (status !== 'all') query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map(normalizeComment);
}

export async function updateCommentStatus(id: string, status: CommentStatus) {
  const { error } = await client().from('blog_comments').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function updateComment(id: string, input: { name?: string; email?: string; comment: string }) {
  const payload = { name: input.name, email: input.email, comment: input.comment };
  const { error } = await client().from('blog_comments').update(payload).eq('id', id);
  if (error) throw error;
}
export async function deleteComment(id: string) {
  const { error } = await client().from('blog_comments').delete().eq('id', id);
  if (error) throw error;
}







