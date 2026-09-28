'use client';

import { useParams } from 'next/navigation';
import { PostDetail } from '@/features/posts/components/post-detail';
import { POST_FIXTURES } from '@/features/posts/data/post-fixtures';

export default function PostDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const post = POST_FIXTURES.find((p) => p.id === id) || POST_FIXTURES[0];

  return <PostDetail post={post} />;
}
