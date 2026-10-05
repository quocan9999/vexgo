'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X, MapPin } from 'lucide-react';

export interface LocationComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  id?: string;
}

export const LocationCombobox: React.FC<LocationComboboxProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Chọn địa điểm',
  className = '',
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter options based on user typing
  const cleanSearch = searchTerm.trim().toLowerCase();
  const filteredOptions = cleanSearch
    ? options.filter((opt) => opt.toLowerCase().includes(cleanSearch))
    : options;

  const handleInputFocus = () => {
    setIsOpen(true);
    setSearchTerm('');
    inputRef.current?.select();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    onChange(val);
    if (!isOpen) setIsOpen(true);
  };

  const handleSelect = (option: string) => {
    onChange(option);
    setSearchTerm('');
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
    inputRef.current?.focus();
    setIsOpen(true);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onClick={() => {
            if (!isOpen) {
              setIsOpen(true);
              setSearchTerm('');
              inputRef.current?.select();
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          className={`h-12 w-full bg-white border border-slate-300 rounded-lg pl-3.5 pr-14 text-sm font-bold text-slate-900 outline-none transition-all focus:border-brand focus:ring-2 focus:ring-brand/10 ${className}`}
        />

        <div className="absolute right-2.5 flex items-center gap-1 text-slate-400">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
              title="Xóa lựa chọn"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            onClick={() => {
              setIsOpen((prev) => !prev);
              if (!isOpen) {
                setSearchTerm('');
                inputRef.current?.focus();
              }
            }}
            className="p-1 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-150 ${
                isOpen ? 'rotate-180 text-brand' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden py-1 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => {
              const isSelected = option === value;
              return (
                <button
                  type="button"
                  key={option}
                  onClick={() => handleSelect(option)}
                  className={`w-full text-left px-3.5 py-2.5 text-sm flex items-center justify-between transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-brand/10 text-brand font-bold'
                      : 'text-slate-800 hover:bg-slate-50 font-medium'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <MapPin
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isSelected ? 'text-brand' : 'text-slate-400'
                      }`}
                    />
                    <span className="truncate">{option}</span>
                  </span>
                  {isSelected && (
                    <Check className="w-4 h-4 text-brand shrink-0 ml-2" />
                  )}
                </button>
              );
            })
          ) : (
            <div className="px-4 py-3 text-center text-xs text-slate-500 font-medium">
              Không tìm thấy địa điểm phù hợp
            </div>
          )}
        </div>
      )}
    </div>
  );
};
