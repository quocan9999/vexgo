// /src/config/axiosClient.ts
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { APP_CONFIG, STORAGE_KEYS } from './constants';

export const axiosClient = axios.create({
  baseURL: APP_CONFIG.API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Request Interceptor: Tự động gán Bearer token
axiosClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// Response Interceptor: Xử lý lỗi tập trung
axiosClient.interceptors.response.use(
  (response) => response.data,
  (error: AxiosError<{ message?: string }>) => {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message || 'Có lỗi xảy ra, vui lòng thử lại';

    if (status === 401 && typeof window !== 'undefined') {
      // Hết hạn token
      localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER_INFO);
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login?expired=1';
      }
    }

    return Promise.reject(new Error(message));
  }
);

export default axiosClient;

