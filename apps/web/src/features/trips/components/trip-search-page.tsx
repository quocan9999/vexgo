'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Trip, searchTripsMock } from '../services/trips.mock';
import { MapPin, Clock, Users, ChevronRight, Filter, Search } from 'lucide-react';
import Link from 'next/link';

export const TripSearchPage = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const origin = searchParams.get('origin') || '';
  const destination = searchParams.get('destination') || '';
  const date = searchParams.get('date') || '';

  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrips = async () => {
      setLoading(true);
      try {
        const results = await searchTripsMock(origin, destination, date);
        setTrips(results);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchTrips();
  }, [origin, destination, date]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-[#f5f5f5] min-h-screen pb-12">
      {/* Search Header */}
      <div className="bg-brand text-white py-8">
        <div className="container mx-auto px-4 max-w-6xl">
          <h1 className="text-2xl font-black mb-6">Kết quả tìm kiếm</h1>
          
          <div className="bg-white rounded-xl p-2 flex flex-col md:flex-row items-center gap-2 shadow-lg">
            <div className="flex-1 flex items-center bg-slate-50 rounded-lg px-4 py-3 w-full">
              <MapPin className="w-5 h-5 text-slate-400 mr-2" />
              <input type="text" defaultValue={origin} placeholder="Điểm đi" className="bg-transparent border-none outline-none text-slate-900 font-bold w-full" readOnly />
            </div>
            <div className="flex-1 flex items-center bg-slate-50 rounded-lg px-4 py-3 w-full">
              <MapPin className="w-5 h-5 text-rose-400 mr-2" />
              <input type="text" defaultValue={destination} placeholder="Điểm đến" className="bg-transparent border-none outline-none text-slate-900 font-bold w-full" readOnly />
            </div>
            <div className="flex-1 flex items-center bg-slate-50 rounded-lg px-4 py-3 w-full">
              <Clock className="w-5 h-5 text-slate-400 mr-2" />
              <input type="date" defaultValue={date} className="bg-transparent border-none outline-none text-slate-900 font-bold w-full" readOnly />
            </div>
            <button className="bg-accent hover:bg-accent-hover text-white font-black px-8 py-3 rounded-lg flex items-center gap-2 w-full md:w-auto justify-center transition-colors">
              <Search className="w-5 h-5" />
              Tìm lại
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-6xl mt-8 flex flex-col lg:flex-row gap-6">
        {/* Filters Sidebar */}
        <div className="w-full lg:w-1/4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
            <div className="flex items-center gap-2 font-black text-slate-900 mb-4 pb-4 border-b border-slate-100">
              <Filter className="w-5 h-5" />
              Bộ lọc tìm kiếm
            </div>
            
            <div className="space-y-6">
              <div>
                <h4 className="font-bold text-sm text-slate-700 mb-3">Giờ đi</h4>
                <div className="space-y-2">
                  {['Sáng sớm (00:00 - 06:00)', 'Sáng (06:00 - 12:00)', 'Chiều (12:00 - 18:00)', 'Tối (18:00 - 24:00)'].map(time => (
                    <label key={time} className="flex items-center gap-2 text-sm text-slate-600">
                      <input type="checkbox" className="rounded text-brand focus:ring-brand" />
                      {time}
                    </label>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="font-bold text-sm text-slate-700 mb-3">Loại xe</h4>
                <div className="space-y-2">
                  {['Giường nằm', 'Limousine', 'Ghế ngồi'].map(type => (
                    <label key={type} className="flex items-center gap-2 text-sm text-slate-600">
                      <input type="checkbox" className="rounded text-brand focus:ring-brand" />
                      {type}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Results List */}
        <div className="w-full lg:w-3/4 space-y-4">
          {loading ? (
            <div className="flex justify-center items-center py-20 bg-white rounded-xl shadow-sm border border-slate-100">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
            </div>
          ) : trips.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-slate-100">
              <p className="text-slate-500 font-medium">Không tìm thấy chuyến xe nào phù hợp.</p>
            </div>
          ) : (
            trips.map(trip => (
              <div key={trip.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 hover:shadow-md transition-shadow">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                  {/* Left: Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-400 text-xs">
                        LOGO
                      </div>
                      <div>
                        <h3 className="font-black text-slate-900">{trip.busCompany.name}</h3>
                        <div className="text-xs font-medium text-slate-500 flex items-center gap-1">
                          ⭐ {trip.busCompany.rating} ({trip.busCompany.reviewsCount} đánh giá)
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-xl font-black text-slate-900">{formatTime(trip.departureTime)}</div>
                        <div className="text-sm font-medium text-slate-500">{trip.route.origin}</div>
                      </div>
                      
                      <div className="flex-1 flex flex-col items-center px-4">
                        <div className="text-xs font-medium text-slate-400 mb-1">{Math.floor(trip.route.durationMinutes / 60)}h{trip.route.durationMinutes % 60}m</div>
                        <div className="w-full flex items-center">
                          <div className="h-2 w-2 rounded-full bg-brand"></div>
                          <div className="flex-1 h-px bg-slate-200 border-t border-dashed border-slate-300"></div>
                          <div className="h-2 w-2 rounded-full border-2 border-brand bg-white"></div>
                        </div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-xl font-black text-slate-900">{formatTime(trip.arrivalTime)}</div>
                        <div className="text-sm font-medium text-slate-500">{trip.route.destination}</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Right: Price & Action */}
                  <div className="w-full md:w-[200px] flex flex-col justify-between items-end border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-4">
                    <div className="text-right w-full flex md:flex-col items-center md:items-end justify-between">
                      <div className="text-2xl font-black text-brand mb-1">{formatCurrency(trip.price)}</div>
                      <div className="text-sm font-medium text-slate-500 flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                        Còn {trip.availableSeats} chỗ trống
                      </div>
                    </div>
                    <Link 
                      href={`/trips/${trip.id}`}
                      className="w-full mt-4 bg-amber-500 hover:bg-amber-600 text-white font-black text-sm px-4 py-3 rounded-lg text-center flex items-center justify-center gap-2 transition-colors"
                    >
                      Chọn chỗ <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
