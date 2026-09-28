// frontend/src/config/apiRoutes.ts

export const API_ROUTES = {
  AUTH: {
    LOGIN: '/api/v1/auth/login',
    REGISTER: '/api/v1/auth/register',
    VERIFY_OTP: '/api/v1/auth/verify-otp',
    RESEND_OTP: '/api/v1/auth/resend-otp',
    FORGOT_PASSWORD: '/api/v1/auth/forgot-password',
    RESET_PASSWORD: '/api/v1/auth/reset-password',
    ME: '/api/v1/auth/me',
    LOGOUT: '/api/v1/auth/logout',
  },
  USERS: {
    BASE: '/api/v1/users',
    PROFILE: '/api/v1/users/profile',
    UPDATE_PROFILE: '/api/v1/users/profile',
    CHANGE_PASSWORD: '/api/v1/users/change-password',
    FAVORITES: '/api/v1/users/favorites',
    TOGGLE_FAVORITE: (postId: string) => `/api/v1/users/favorites/${postId}`,
  },
  POSTS: {
    BASE: '/api/v1/posts',
    PUBLIC_LIST: '/api/v1/posts',
    FEATURED: '/api/v1/posts/featured',
    MY_POSTS: '/api/v1/posts/my-posts',
    CREATE: '/api/v1/posts',
    BY_ID: (id: string) => `/api/v1/posts/${id}`,
    UPDATE: (id: string) => `/api/v1/posts/${id}`,
    DELETE: (id: string) => `/api/v1/posts/${id}`,
    TOGGLE_HIDE: (id: string) => `/api/v1/posts/${id}/toggle-hide`,
    MARK_COMPLETED: (id: string) => `/api/v1/posts/${id}/complete`,
    RENEW: (id: string) => `/api/v1/posts/${id}/renew`,
  },
  CONTACTS: {
    SUBMIT: '/api/v1/contacts',
  },
  COMMON: {
    LOCATIONS: '/api/v1/common/locations',
    UPLOAD_IMAGE: '/api/v1/common/upload',
    SETTINGS: '/api/v1/common/settings',
  },
  ADMIN: {
    STATS: '/api/v1/admin/stats',
    POSTS: '/api/v1/admin/posts',
    POST_DETAIL: (id: string) => `/api/v1/admin/posts/${id}`,
    APPROVE_POST: (id: string) => `/api/v1/admin/posts/${id}/approve`,
    REJECT_POST: (id: string) => `/api/v1/admin/posts/${id}/reject`,
    MEMBERS: '/api/v1/admin/members',
    MEMBER_DETAIL: (id: string) => `/api/v1/admin/members/${id}`,
    MEMBER_POSTS: (id: string) => `/api/v1/admin/members/${id}/posts`,
    LOCK_MEMBER: (id: string) => `/api/v1/admin/members/${id}/lock`,
    UNLOCK_MEMBER: (id: string) => `/api/v1/admin/members/${id}/unlock`,
    CONTACTS: '/api/v1/admin/contacts',
    UPDATE_CONTACT_STATUS: (id: string) => `/api/v1/admin/contacts/${id}/status`,
    BANNERS: '/api/v1/admin/banners',
    SETTINGS: '/api/v1/admin/settings',
  },
} as const;

export const apiRoutes = API_ROUTES;
