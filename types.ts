export interface MerchantInfo {
  shopNumber: string;
  shopCardImageFile: File | null;
  shopCardImagePreview: string | null; // base64 string
}

export interface Item {
  id: string;
  name: string;
  price: number;
  packing: number;
  cartons: number;
  imageFile: File | null;
  imagePreview: string | null; // base64 string
  subtotal: number;
}

export interface ReportData {
  officeName: string;
  currentDate: string;
  customerName: string; // Added customer name
  merchantInfo: MerchantInfo;
  items: Item[];
  grandTotal: number;
  currencySymbol: string;
}