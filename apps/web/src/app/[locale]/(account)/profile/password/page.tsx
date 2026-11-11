import { ProfileSidebar } from '@/features/account/components/profile-sidebar';
import { PasswordForm } from '@/features/account/components/password-form';

export default function ProfilePasswordPage() {
  return (
    <div className="min-h-screen bg-[#F5F5F5] py-8 md:py-12">
      <div className="max-w-[1050px] mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row gap-6 md:gap-8">
          {/* Sidebar */}
          <div className="w-full md:w-[280px] shrink-0">
            <ProfileSidebar />
          </div>
          
          {/* Main Content */}
          <div className="flex-1">
            <PasswordForm />
          </div>
        </div>
      </div>
    </div>
  );
}
