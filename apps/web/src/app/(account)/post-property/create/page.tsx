import { redirect } from 'next/navigation';

export default function CreatePostPage() {
  redirect('/posts?needType=BUY');
}
