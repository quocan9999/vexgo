/* eslint-disable */
export interface LuggageItem {
  id: string;
  type: string;
  quantity: number;
  weight: number;
  length?: number;
  width?: number;
  height?: number;
  category: "normal" | "fragile" | "valuable";
  note?: string;
}
