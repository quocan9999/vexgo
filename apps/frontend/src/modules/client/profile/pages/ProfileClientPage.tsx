'use client';

import React from 'react';
import { ProfileSidebar } from '../components/ProfileSidebar';
import { ProfileForm } from '../components/ProfileForm';

export const ProfileClientPage: React.FC = () => {
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
            <ProfileForm />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileClientPage;
