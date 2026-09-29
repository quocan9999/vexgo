sed -i '' '/<datalist id="origin-options">/,/<\/datalist>/c\
                    <datalist id="origin-options">\
                      {originOptions.length > 0 ? originOptions.map(o => <option key={o} value={o} />) : (\
                        <>\
                          <option value="TP.HCM" />\
                          <option value="Hà Nội" />\
                          <option value="Đà Nẵng" />\
                          <option value="Cần Thơ" />\
                          <option value="Vũng Tàu" />\
                        </>\
                      )}\
                    </datalist>' apps/web/src/features/home/components/hero-section.tsx

sed -i '' '/<datalist id="destination-options">/,/<\/datalist>/c\
                    <datalist id="destination-options">\
                      {destinationOptions.length > 0 ? destinationOptions.map(o => <option key={o} value={o} />) : (\
                        <>\
                          <option value="Đà Lạt" />\
                          <option value="Nha Trang" />\
                          <option value="Đà Nẵng" />\
                          <option value="Huế" />\
                          <option value="Cần Thơ" />\
                          <option value="Vũng Tàu" />\
                        </>\
                      )}\
                    </datalist>' apps/web/src/features/home/components/hero-section.tsx
