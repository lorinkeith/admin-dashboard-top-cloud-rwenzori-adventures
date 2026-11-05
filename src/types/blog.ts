export type BlogStatus = 'draft' | 'published' | 'scheduled' | 'archived';
export type CommentStatus = 'pending' | 'approved' | 'rejected' | 'spam';

export type BlogCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  post_count?: number;
};

export type BlogTag = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  post_count?: number;
};

export type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  featured_image_url: string | null;
  featured_image_path: string | null;
  featured_image_alt: string | null;
  category_id: string | null;
  author_id: string | null;
  author_name: string | null;
  status: BlogStatus;
  seo_title: string | null;
  meta_description: string | null;
  focus_keyword: string | null;
  seo_keywords: string[] | null;
  canonical_url: string | null;
  is_featured: boolean;
  allow_comments: boolean;
  published_at: string | null;
  scheduled_at: string | null;
  created_at: string;
  updated_at: string;
  blog_categories?: BlogCategory | null;
  blog_tags?: BlogTag[];
};

export type BlogComment = {
  id: string;
  post_id: string;
  name: string;
  email: string;
  comment: string;
  status: CommentStatus;
  created_at: string;
  blog_posts?: Pick<BlogPost, 'id' | 'title' | 'slug'> | null;
};

export type BlogMediaItem = {
  name: string;
  id: string | null;
  updated_at: string | null;
  created_at: string | null;
  last_accessed_at: string | null;
  metadata: Record<string, unknown> | null;
  publicUrl: string;
  path: string;
};
