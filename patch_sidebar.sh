sed -i '' '/{[/]* LỌC CHUYẾN [*]\/}/i\
            {/* CHUYẾN ĐI CỦA BẠN */}\
            <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-100">\
              <div className="bg-[#f05123] px-4 py-3">\
                <h2 className="text-white font-bold text-[13px] uppercase">CHUYẾN ĐI CỦA BẠN</h2>\
              </div>\
              <div className="p-4 space-y-3">\
                <div className="flex items-center justify-between text-slate-800 font-bold text-sm">\
                  <span>07:30</span>\
                  <div className="flex items-center gap-1 text-slate-400 text-xs font-normal">\
                    <div className="w-2 h-2 rounded-full border-2 border-[#00b14f]"></div>\
                    <span className="border-t border-dashed w-6"></span>\
                    <span>03:30 h</span>\
                    <span className="border-t border-dashed w-6"></span>\
                    <MapPin size={12} className="text-[#f05123]" fill="#f05123" />\
                  </div>\
                  <span>11:00</span>\
                </div>\
                <div className="flex items-center justify-between text-xs font-bold text-slate-600">\
                  <span>{searchParams.get('"'"'origin'"'"') || searchParams.get('"'"'from'"'"') || '"'"'Nơi đi'"'"'}</span>\
                  <span>{searchParams.get('"'"'destination'"'"') || searchParams.get('"'"'to'"'"') || '"'"'Nơi đến'"'"'}</span>\
                </div>\
                <div className="text-xs text-slate-500 pt-2 border-t border-slate-100">\
                  <span className="font-bold">Ngày đi:</span> {searchParams.get('"'"'date'"'"') || '"'"'Chưa chọn ngày'"'"'}\
                </div>\
              </div>\
            </div>\
\
' apps/web/src/features/trips/components/trip-list.tsx
