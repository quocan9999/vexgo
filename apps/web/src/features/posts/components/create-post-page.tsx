import { redirect } from 'next/navigation';

export default function CreatePropertyApp() {
  redirect('/posts?needType=BUY');
}
