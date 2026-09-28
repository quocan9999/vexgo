'use client';

import type { ILuggageItem } from "./luggage-item";
import React from 'react';
import { Plus } from 'lucide-react';

import { LuggageItemComponent } from './luggage-item';

interface LuggageFormProps {
  items: ILuggageItem[];
  onChange: (items: ILuggageItem[]) => void;
}

export const LuggageForm: React.FC<LuggageFormProps> = ({ items, onChange }) => {
  const handleAddItem = () => {
    const newItem: ILuggageItem = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'Vali',
      quantity: 1,
      weight: 0,
      category: 'normal',
    };
    onChange([...items, newItem]);
  };

  const handleRemoveItem = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
  };

  const handleChangeItem = (id: string, field: keyof ILuggageItem, value: any) => {
    onChange(
      items.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <LuggageItemComponent
          key={item.id}
          index={index}
          item={item}
          onChange={handleChangeItem}
          onRemove={handleRemoveItem}
        />
      ))}

      <button
        type="button"
        onClick={handleAddItem}
        className="flex items-center gap-2 text-sm font-bold text-accent hover:text-accent-hover transition-colors"
      >
        <Plus className="w-4 h-4" />
        Thêm kiện hành lý
      </button>
    </div>
  );
};
