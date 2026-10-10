/* eslint-disable */
'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';


interface LuggageItemProps {
  index: number;
  item: ILuggageItem;
  onChange: (id: string, fieldOrUpdates: keyof ILuggageItem | Partial<ILuggageItem>, value?: any) => void;
  onRemove: (id: string) => void;
}

export const LuggageItemComponent: React.FC<LuggageItemProps> = ({ index, item, onChange, onRemove }) => {
  const isMotorbike = item.type === 'Xe máy';
  const isBicycle = item.type === 'Xe đạp';
  const isVehicle = isMotorbike || isBicycle;

  return (
    <div className="p-4 border border-slate-200 rounded-lg bg-slate-50 relative">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-sm font-bold text-slate-800">
          {isMotorbike
            ? `Phương tiện ${index + 1}: Xe máy`
            : isBicycle
              ? `Phương tiện ${index + 1}: Xe đạp`
              : `Kiện ${index + 1}`}
        </h4>
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          className="text-red-500 hover:text-red-700 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-xs font-bold text-slate-700">Loại hành lý</span>
          <select
            className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-accent bg-white"
            value={item.type}
            onChange={(e) => {
              const newType = e.target.value;
              if (newType === 'Xe máy') {
                onChange(item.id, {
                  type: 'Xe máy',
                  weight: 100,
                  motorbikeType: item.motorbikeType || 'Xe số',
                  bicycleType: undefined,
                  length: undefined,
                  width: undefined,
                  height: undefined,
                });
              } else if (newType === 'Xe đạp') {
                onChange(item.id, {
                  type: 'Xe đạp',
                  weight: 15,
                  bicycleType: item.bicycleType || 'Xe đạp thường',
                  motorbikeType: undefined,
                  licensePlate: undefined,
                  length: undefined,
                  width: undefined,
                  height: undefined,
                });
              } else {
                onChange(item.id, {
                  type: newType,
                  weight: (item.type === 'Xe máy' || item.type === 'Xe đạp') ? 0 : item.weight,
                });
              }
            }}
          >
            <option value="Vali">Vali</option>
            <option value="Balo / Túi du lịch">Balo / Túi du lịch</option>
            <option value="Thùng xốp / Thùng carton">Thùng xốp / Thùng carton</option>
            <option value="Xe máy">Xe máy</option>
            <option value="Xe đạp">Xe đạp</option>
            <option value="Hành lý / Đồ cồng kềnh khác">Hành lý / Đồ cồng kềnh khác</option>
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-bold text-slate-700">Số lượng</span>
          <input
            type="number"
            min="1"
            className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-accent bg-white"
            value={item.quantity}
            onChange={(e) => onChange(item.id, 'quantity', parseInt(e.target.value) || 1)}
          />
        </label>

        {isMotorbike ? (
          <>
            <label className="block">
              <span className="text-xs font-bold text-slate-700">Dòng xe máy</span>
              <select
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-accent bg-white"
                value={item.motorbikeType || 'Xe số'}
                onChange={(e) => onChange(item.id, 'motorbikeType', e.target.value)}
              >
                <option value="Xe số">Xe số (Wave, Sirius, Future...)</option>
                <option value="Xe tay ga">Xe tay ga (Vision, AirBlade, Lead...)</option>
                <option value="Xe tay ga lớn / SH">Xe tay ga lớn (SH, NVX, Vespa...)</option>
                <option value="Xe côn tay / Moto">Xe côn tay / Phân khối lớn (Winner, Exciter...)</option>
                <option value="Xe máy điện">Xe máy điện (VinFast, Dat Bike...)</option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-bold text-slate-700">Biển số xe</span>
              <input
                type="text"
                placeholder="Ví dụ: 59A-123.45"
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-accent bg-white uppercase"
                value={item.licensePlate || ''}
                onChange={(e) => onChange(item.id, 'licensePlate', e.target.value.toUpperCase())}
              />
            </label>
          </>
        ) : isBicycle ? (
          <>
            <label className="block">
              <span className="text-xs font-bold text-slate-700">Loại xe đạp</span>
              <select
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-accent bg-white"
                value={item.bicycleType || 'Xe đạp thường'}
                onChange={(e) => onChange(item.id, 'bicycleType', e.target.value)}
              >
                <option value="Xe đạp thường">Xe đạp thông thường / mini</option>
                <option value="Xe đạp thể thao">Xe đạp thể thao / địa hình (MTB)</option>
                <option value="Xe đạp đua / cuộc">Xe đạp đua / Road bike</option>
                <option value="Xe đạp điện">Xe đạp điện / Trợ lực điện</option>
                <option value="Xe đạp gấp">Xe đạp gấp</option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-bold text-slate-700">Tình trạng xe</span>
              <select
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-accent bg-white"
                value={item.category}
                onChange={(e) => onChange(item.id, 'category', e.target.value)}
              >
                <option value="normal">Nguyên chiếc (không tháo)</option>
                <option value="fragile">Xe giá trị cao / Carbon (cần bao bọc kỹ)</option>
              </select>
            </label>
          </>
        ) : (
          <>
            <label className="block">
              <span className="text-xs font-bold text-slate-700">Khối lượng ước tính (kg)</span>
              <input
                type="number"
                min="0"
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-accent bg-white"
                value={item.weight || ''}
                onChange={(e) => onChange(item.id, 'weight', parseFloat(e.target.value) || 0)}
                placeholder="Ví dụ: 15"
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold text-slate-700">Loại hàng</span>
              <select
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-accent bg-white"
                value={item.category}
                onChange={(e) => onChange(item.id, 'category', e.target.value)}
              >
                <option value="normal">Hàng thường</option>
                <option value="fragile">Dễ vỡ</option>
                <option value="valuable">Giá trị cao</option>
              </select>
            </label>
          </>
        )}
      </div>

      {isMotorbike ? (
        <div className="mt-4 rounded-xl border border-amber-200/90 bg-amber-50/60 p-3.5 text-xs">
          <div className="flex items-center gap-2 mb-2 font-bold text-amber-900">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] text-white">
              📌
            </span>
            <span>Quy định nhận & bàn giao xe máy:</span>
          </div>
          <ul className="space-y-1.5 pl-1 text-[12px] text-slate-700">
            <li className="flex items-start gap-2">
              <span className="text-amber-600 font-bold">•</span>
              <span>
                <strong>Thời gian ra bến:</strong> Có mặt trước giờ khởi hành{' '}
                <span className="inline-block rounded bg-amber-100 px-1.5 py-0.5 font-bold text-amber-900">
                  90–120 phút
                </span>{' '}
                (hoặc sớm hơn vào các dịp cao điểm Lễ, Tết).
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-600 font-bold">•</span>
              <span>
                <strong>Giấy tờ bắt buộc:</strong> Xuất trình{' '}
                <strong className="text-slate-900">cà-vẹt xe (bản gốc)</strong> để nhân viên lập biên bản bàn giao phương tiện.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-600 font-bold">•</span>
              <span>
                <strong>Quy trình kỹ thuật:</strong> Xe được rút cạn xăng và bọc chống trầy xước trước khi xếp vào khoang hầm chuyên dụng.
              </span>
            </li>
          </ul>
        </div>
      ) : isBicycle ? (
        <div className="mt-4 rounded-xl border border-sky-200/90 bg-sky-50/60 p-3.5 text-xs">
          <div className="flex items-center gap-2 mb-2 font-bold text-sky-950">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-[10px] text-white">
              🚲
            </span>
            <span>Lưu ý gửi xe đạp theo chuyến:</span>
          </div>
          <ul className="space-y-1.5 pl-1 text-[12px] text-slate-700">
            <li className="flex items-start gap-2">
              <span className="text-sky-600 font-bold">•</span>
              <span>
                <strong>Thời gian ra bến:</strong> Có mặt trước giờ xe chạy ít nhất{' '}
                <span className="inline-block rounded bg-sky-100 px-1.5 py-0.5 font-bold text-sky-900">
                  20–30 phút
                </span>.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-sky-600 font-bold">•</span>
              <span>
                <strong>Hỗ trợ sắp xếp:</strong> Phụ xe sẽ hỗ trợ chằng buộc hoặc tháo bánh trước/hạ yên xe để xếp gọn gàng vào ngăn hầm hành lý lớn.
              </span>
            </li>
          </ul>
        </div>
      ) : (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-slate-700">
              Kích thước (cm) - Tối đa 150x80x80cm
            </span>
            {item.length && item.width && item.height ? (
              <span className="text-[11px] font-semibold text-slate-500">
                Quy đổi: {Number(((item.length * item.width * item.height) / 5000).toFixed(2))}kg
              </span>
            ) : null}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <input
                type="number"
                placeholder="Dài (tối đa 150)"
                max={150}
                className={`h-10 w-full rounded-lg border px-3 text-sm font-semibold outline-none focus:border-accent bg-white ${
                  item.length && item.length > 150 ? 'border-red-500 text-red-600' : 'border-slate-300'
                }`}
                value={item.length || ''}
                onChange={(e) => onChange(item.id, 'length', parseFloat(e.target.value) || undefined)}
              />
              {item.length && item.length > 150 ? (
                <span className="text-[10px] text-red-500 font-bold">Tối đa 150cm</span>
              ) : null}
            </div>
            <div>
              <input
                type="number"
                placeholder="Rộng (tối đa 80)"
                max={80}
                className={`h-10 w-full rounded-lg border px-3 text-sm font-semibold outline-none focus:border-accent bg-white ${
                  item.width && item.width > 80 ? 'border-red-500 text-red-600' : 'border-slate-300'
                }`}
                value={item.width || ''}
                onChange={(e) => onChange(item.id, 'width', parseFloat(e.target.value) || undefined)}
              />
              {item.width && item.width > 80 ? (
                <span className="text-[10px] text-red-500 font-bold">Tối đa 80cm</span>
              ) : null}
            </div>
            <div>
              <input
                type="number"
                placeholder="Cao (tối đa 80)"
                max={80}
                className={`h-10 w-full rounded-lg border px-3 text-sm font-semibold outline-none focus:border-accent bg-white ${
                  item.height && item.height > 80 ? 'border-red-500 text-red-600' : 'border-slate-300'
                }`}
                value={item.height || ''}
                onChange={(e) => onChange(item.id, 'height', parseFloat(e.target.value) || undefined)}
              />
              {item.height && item.height > 80 ? (
                <span className="text-[10px] text-red-500 font-bold">Tối đa 80cm</span>
              ) : null}
            </div>
          </div>
          {((item.length && item.length > 150) || (item.width && item.width > 80) || (item.height && item.height > 80)) && (
            <p className="mt-1.5 text-xs text-red-500 font-semibold">
              ⚠️ Kích thước vượt quá cửa hầm xe khách (Dài ≤ 150cm, Rộng ≤ 80cm, Cao ≤ 80cm). Vui lòng đóng gói lại hoặc liên hệ gửi xe tải.
            </p>
          )}
          {item.length && item.width && item.height && (() => {
            const volWeight = Number(((item.length * item.width * item.height) / 5000).toFixed(2));
            const actualWeight = Number((item.weight || 0).toFixed(2));
            if (volWeight > actualWeight && actualWeight > 0) {
              return (
                <div className="mt-2.5 px-3 py-2 rounded-lg bg-slate-100/90 border border-slate-200 text-xs text-slate-700 flex items-center justify-between gap-3">
                  <span className="leading-relaxed">
                    <strong className="text-slate-900 font-bold">Kiện hàng to chiếm chỗ hầm xe:</strong>{' '}
                    <span className="text-slate-600">
                      Tính cước theo <strong className="text-slate-900 font-bold">{volWeight}kg</strong> thay vì {actualWeight}kg thực tế
                    </span>
                  </span>
                  <span className="font-extrabold text-slate-950 shrink-0 bg-white px-2 py-0.5 rounded border border-slate-300 text-[11px] shadow-2xs">
                    {volWeight} kg
                  </span>
                </div>
              );
            }
            return null;
          })()}
        </div>
      )}

      <label className="block mt-4">
        <span className="text-xs font-bold text-slate-700">Ghi chú</span>
        <input
          type="text"
          className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-accent bg-white"
          value={item.note || ''}
          onChange={(e) => onChange(item.id, 'note', e.target.value)}
          placeholder={isMotorbike ? 'Ví dụ: Xe Wave Alpha màu đỏ, có trầy yếm trước' : 'Ghi chú thêm về hành lý'}
        />
      </label>
      
      {!isMotorbike && item.category === 'fragile' && (
         <div className="mt-3 flex items-center gap-2">
            <input type="checkbox" id={`fragile-${item.id}`} className="accent-red-500 w-4 h-4 rounded" defaultChecked />
            <label htmlFor={`fragile-${item.id}`} className="text-xs font-semibold text-slate-700">Hàng dễ vỡ, cần xử lý cẩn thận</label>
         </div>
      )}
    </div>
  );
};

export interface ILuggageItem {
  id: string;
  type: string;
  quantity: number;
  weight: number;
  length?: number;
  width?: number;
  height?: number;
  category: "normal" | "fragile" | "valuable";
  note?: string;
  motorbikeType?: string;
  licensePlate?: string;
  bicycleType?: string;
}
