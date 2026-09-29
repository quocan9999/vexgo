import { PostList } from '@/features/posts/components/post-list';
import { POST_FIXTURES } from '@/features/posts/data/post-fixtures';

export default function PostsPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#F5F5F5] py-8">
      <PostList 
        initialPosts={POST_FIXTURES} 
        hideSearchForm={false}
      />
    </div>
  );
}
