/* eslint-disable */
// frontend/src/modules/client/contacts/components/ContactPageContent.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin, Phone, Mail, Send, CheckCircle2 } from 'lucide-react';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { contactApi } from '../services/contact.api';
import { useAuthSession } from '@/features/auth/auth-session';
import { customerApi } from '@/features/account/services/customer.api';

export const ContactPageContent: React.FC = () => {
  const { user, executeWithAuth, isAuthenticated } = useAuthSession();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSent, setIsSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;

    if (user?.fullName) {
      setFullName((curr) => curr || user.fullName);
    }
    if (user?.phoneNumber) {
      setPhone((curr) => curr || user.phoneNumber);
    }

    executeWithAuth((token) => customerApi.getMe(token))
      .then((res) => {
        if (!active || !res?.data) return;
        if (res.data.fullName) {
          setFullName((curr) => curr || res.data.fullName);
        }
        if (res.data.phoneNumber) {
          setPhone((curr) => curr || res.data.phoneNumber);
        }
        if (res.data.email) {
          setEmail((curr) => curr || res.data.email || '');
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [isAuthenticated, executeWithAuth, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      await contactApi.submitContact({
        fullName: fullName.trim(),
        phoneNumber: phone.trim(),
        email: email.trim() || undefined,
        subject: subject.trim(),
        message: message.trim(),
      });
      setIsSent(true);
      setFullName('');
      setPhone('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Gửi yêu cầu thất bại.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">

      <div className="text-center max-w-xl mx-auto space-y-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Liên Hệ Hỗ Trợ Khách Hàng
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Cần hỗ trợ đặt vé, hủy vé, tra cứu hóa đơn, gửi hàng hoặc thanh toán, vui lòng gửi yêu cầu.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Thông tin liên hệ */}
        <div className="bg-brand-dark text-white p-6 rounded-2xl space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-base font-bold text-amber-400">Thông Tin Liên Hệ</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              VexGo hỗ trợ khách hàng trước, trong và sau chuyến đi qua hotline, email và chat realtime.
            </p>

            <div className="space-y-3 pt-2 text-xs text-slate-200">
              <p className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                <span>TP. Hồ Chí Minh & các tỉnh lân cận</span>
              </p>
              <p className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>0900.000.000</span>
              </p>
              <p className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>support@vexgo.vn</span>
              </p>
            </div>
          </div>

          <div className="p-4 bg-white/10 rounded-xl text-[11px] text-slate-300 border border-white/10">
            Hỗ trợ: 24/7 cho vé xe, vận đơn và sự cố chuyến đi
          </div>
        </div>

        {/* Form liên hệ */}
        <div className="lg:col-span-2 bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm">
          {isSent ? (
            <div className="text-center py-10 space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
              <h3 className="text-lg font-bold text-slate-900">Gửi Tin Nhắn Thành Công!</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Cảm ơn bạn đã liên hệ. Ban quản trị sẽ phản hồi lại bạn qua số điện thoại hoặc email trong thời gian sớm nhất.
              </p>
              <button
                type="button"
                onClick={() => setIsSent(false)}
                className="mt-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700"
              >
                Gửi thêm tin nhắn
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Họ và tên"
                  placeholder="Ví dụ: Nguyễn Văn A"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  isRequired
                />
                <Input
                  label="Số điện thoại"
                  placeholder="Ví dụ: 0912345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  isRequired
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Email (tùy chọn)"
                  placeholder="example@gmail.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Input
                  label="Tiêu đề yêu cầu"
                  placeholder="Ví dụ: Hỗ trợ hủy vé"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  isRequired
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Nội dung liên hệ <span className="text-rose-600">*</span>:
                </label>
                <textarea
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Nhập nội dung cần hỗ trợ chi tiết..."
                  className="w-full bg-white text-slate-900 text-xs sm:text-sm p-3 rounded-xl border border-slate-300 focus:border-brand outline-none"
                  required
                />
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 font-semibold">
                  {errorMessage}
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                disabled={isSubmitting}
              >
                <Send className="w-4 h-4 mr-1.5" />
                <span>{isSubmitting ? 'ĐANG GỬI...' : 'GỬI YÊU CẦU LIÊN HỆ'}</span>
              </Button>
            </form>
          )}
        </div>
      </div>
      </div>
    </div>
  );
};
