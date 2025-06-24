
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { MerchantInfo, Item, ReportData } from './types';
import { CURRENCY_SYMBOL, OFFICE_NAME } from './constants';
import ImageInput from './components/ImageInput';
import ReportLayout from './components/ReportLayout';
// html2canvas is loaded from CDN, declare its type for TypeScript
declare var html2canvas: any;


const App: React.FC = () => {
  const [customerName, setCustomerName] = useState<string>('');
  const [merchantInfo, setMerchantInfo] = useState<MerchantInfo>({
    shopNumber: '',
    shopCardImageFile: null,
    shopCardImagePreview: null,
  });
  const [items, setItems] = useState<Item[]>([]);
  const [currentItem, setCurrentItem] = useState<Omit<Item, 'id' | 'subtotal' | 'imagePreview'>>({
    name: '',
    price: 0,
    packing: 0,
    cartons: 0,
    imageFile: null,
  });
  const [currentItemImagePreview, setCurrentItemImagePreview] = useState<string | null>(null);

  const [currentDate, setCurrentDate] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showReportPreview, setShowReportPreview] = useState<boolean>(false);
  const reportCaptureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const today = new Date();
    setCurrentDate(today.toLocaleDateString('ar-EG-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' }));
  }, []);

  const fileToBase64 = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  }, []);

  const handleCustomerNameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setCustomerName(event.target.value);
  }, []);

  const handleMerchantInfoChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setMerchantInfo(prev => ({ ...prev, shopNumber: event.target.value }));
  }, []);

  const handleShopCardImageSelected = useCallback(async (file: File) => {
    const preview = await fileToBase64(file);
    setMerchantInfo(prev => ({ ...prev, shopCardImageFile: file, shopCardImagePreview: preview }));
  }, [fileToBase64]);

  const handleCurrentItemChange = useCallback((event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setCurrentItem(prev => ({ ...prev, [name]: name === 'price' || name === 'packing' || name === 'cartons' ? parseFloat(value) || 0 : value }));
  }, []);
  
  const handleCurrentItemImageSelected = useCallback(async (file: File) => {
    const preview = await fileToBase64(file);
    setCurrentItem(prev => ({ ...prev, imageFile: file }));
    setCurrentItemImagePreview(preview);
  }, [fileToBase64]);

  const handleAddItem = useCallback(() => {
    if (!currentItem.name || currentItem.price <= 0 || currentItem.packing <= 0 || currentItem.cartons <= 0) {
      alert("الرجاء تعبئة جميع حقول العنصر بشكل صحيح (الاسم، السعر، التعبئة، عدد الكراتين). صورة العنصر اختيارية.");
      return;
    }
    const subtotal = currentItem.price * currentItem.packing * currentItem.cartons;
    setItems(prevItems => [...prevItems, { 
      ...currentItem, 
      id: crypto.randomUUID(), 
      imagePreview: currentItemImagePreview, 
      subtotal 
    }]);
    setCurrentItem({ name: '', price: 0, packing: 0, cartons: 0, imageFile: null });
    setCurrentItemImagePreview(null);
     // Reset the file input visually if possible - this is tricky without direct access or key change
    const itemImageInput = document.getElementById('image-upload-currentItem') as HTMLInputElement | null;
    if (itemImageInput) itemImageInput.value = "";

  }, [currentItem, currentItemImagePreview]);

  const handleRemoveItem = useCallback((itemId: string) => {
    setItems(prevItems => prevItems.filter(item => item.id !== itemId));
  }, []);

  const grandTotal = useMemo(() => {
    return items.reduce((total, item) => total + item.subtotal, 0);
  }, [items]);


  const generateReportData = useCallback((): ReportData => {
    return {
      officeName: OFFICE_NAME,
      currentDate,
      customerName, 
      merchantInfo,
      items,
      grandTotal,
      currencySymbol: CURRENCY_SYMBOL,
    };
  }, [currentDate, customerName, merchantInfo, items, grandTotal]);


  const captureReportAsCanvas = async (): Promise<HTMLCanvasElement | null> => {
    if (!reportCaptureRef.current) return null;
    
    const originalDisplay = reportCaptureRef.current.style.display;
    reportCaptureRef.current.style.display = 'block';
    
    const canvas = await html2canvas(reportCaptureRef.current, { 
        scale: 2, 
        useCORS: true, 
        logging: false,
        backgroundColor: '#ffffff',
        onclone: (document: Document) => {
            const clonedReportElement = document.getElementById('report-capture-content');
            if (clonedReportElement) {
                // Ensure images are loaded, base64 should be fine.
            }
        }
    });
    
    reportCaptureRef.current.style.display = originalDisplay;
    return canvas;
};


  const handleSaveAsPng = useCallback(async () => {
    if (!customerName.trim() && !merchantInfo.shopNumber.trim() && items.length === 0) {
        alert("الرجاء إدخال اسم الزبون أو رقم المحل وإضافة بعض العناصر قبل الحفظ.");
        return;
    }
    setIsLoading(true);
    setShowReportPreview(true); 

    setTimeout(async () => {
        const canvas = await captureReportAsCanvas();
        if (canvas) {
            const image = canvas.toDataURL('image/png', 1.0);
            const link = document.createElement('a');
            const fileNameBase = customerName.trim() || merchantInfo.shopNumber.trim() || 'فاتورة';
            link.download = `${fileNameBase}_${new Date().toISOString().split('T')[0]}.png`;
            link.href = image;
            link.click();
        } else {
            alert("حدث خطأ أثناء إنشاء الصورة. الرجاء المحاولة مرة أخرى.");
        }
        setShowReportPreview(false); 
        setIsLoading(false);
    }, 100); 
  }, [generateReportData, customerName, merchantInfo.shopNumber, items.length]);


  const handleSendToWhatsApp = useCallback(async () => {
    if (!customerName.trim() && !merchantInfo.shopNumber.trim() && items.length === 0) {
        alert("الرجاء إدخال اسم الزبون أو رقم المحل وإضافة بعض العناصر قبل المشاركة.");
        return;
    }
    setIsLoading(true);
    setShowReportPreview(true); 
    
    setTimeout(async () => {
        const canvas = await captureReportAsCanvas();
        if (canvas) {
            canvas.toBlob(async (blob) => {
            if (blob) {
                try {
                const fileNameBase = customerName.trim() || merchantInfo.shopNumber.trim() || 'فاتورة';
                const file = new File([blob], `${fileNameBase}_${new Date().toISOString().split('T')[0]}.png`, { type: 'image/png' });
                
                let shareText = `فاتورة من ${OFFICE_NAME}.`;
                if (customerName.trim()) {
                    shareText += ` للزبون: ${customerName.trim()}`;
                }
                if (merchantInfo.shopNumber.trim()) {
                    shareText += ` محل رقم: ${merchantInfo.shopNumber.trim()}`;
                }

                if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                    await navigator.share({
                    files: [file],
                    title: `فاتورة ${OFFICE_NAME}`,
                    text: shareText,
                    });
                } else {
                    alert("ميزة المشاركة المباشرة غير مدعومة في هذا المتصفح أو تم إلغاؤها. يمكنك حفظ الصورة ومشاركتها يدويًا.");
                    handleSaveAsPng(); 
                }
                } catch (error) {
                console.error("Error sharing:", error);
                alert("حدث خطأ أثناء محاولة مشاركة الصورة. يمكنك حفظ الصورة ومشاركتها يدويًا.");
                handleSaveAsPng(); 
                }
            } else {
                alert("حدث خطأ أثناء تحويل الصورة. الرجاء المحاولة مرة أخرى.");
            }
            }, 'image/png', 0.95); 
        } else {
            alert("حدث خطأ أثناء إنشاء الصورة للمشاركة. الرجاء المحاولة مرة أخرى.");
        }
        setShowReportPreview(false);
        setIsLoading(false);
    }, 100);
  }, [generateReportData, customerName, merchantInfo.shopNumber, items.length, handleSaveAsPng]);

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-4xl bg-white shadow-xl rounded-lg my-8">
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl text-center">
            <p className="text-lg font-semibold text-gray-900">جاري المعالجة...</p>
          </div>
        </div>
      )}

      <div ref={reportCaptureRef} id="report-capture-content" style={{ position: 'absolute', left: '-9999px', top: 'auto', display: showReportPreview ? 'block' : 'none' }}>
        {showReportPreview && <ReportLayout data={generateReportData()} />}
      </div>
      
      <header className="text-center mb-6 pb-4 border-b-2 border-gray-300">
        <h1 className="text-3xl font-bold text-black">{OFFICE_NAME}</h1>
        <p className="text-md text-gray-600 mt-1">{currentDate}</p>
      </header>

      <section className="mb-6 p-4 border border-gray-200 rounded-md bg-gray-50">
        <div className="mb-4">
            <label htmlFor="customerName" className="block text-sm font-medium text-gray-900 mb-1">اسم الزبون</label>
            <input
              type="text"
              id="customerName"
              name="customerName"
              value={customerName}
              onChange={handleCustomerNameChange}
              className="input-field"
              placeholder="ادخل اسم الزبون (اختياري)"
            />
          </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-3 pt-3 border-t border-gray-200">معلومات المحل</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="shopNumber" className="block text-sm font-medium text-gray-900 mb-1">رقم المحل</label>
            <input
              type="text"
              id="shopNumber"
              name="shopNumber"
              value={merchantInfo.shopNumber}
              onChange={handleMerchantInfoChange}
              className="input-field"
              placeholder="ادخل رقم المحل (اختياري)"
            />
          </div>
          <ImageInput 
            label="صورة كرت المحل" 
            onImageSelected={handleShopCardImageSelected}
            currentImagePreview={merchantInfo.shopCardImagePreview}
            idSuffix="shopCard"
          />
        </div>
      </section>

      <section className="mb-6 p-4 border border-gray-200 rounded-md bg-gray-50">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">إضافة عنصر جديد</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
          <ImageInput 
            label="صورة العنصر (اختياري)"
            onImageSelected={handleCurrentItemImageSelected}
            currentImagePreview={currentItemImagePreview}
            idSuffix="currentItem"
          />
          <div>
            <label htmlFor="itemName" className="block text-sm font-medium text-gray-900 mb-1">اسم العنصر</label>
            <input type="text" id="itemName" name="name" value={currentItem.name} onChange={handleCurrentItemChange} className="input-field" />
          </div>
          <div>
            <label htmlFor="itemPrice" className="block text-sm font-medium text-gray-900 mb-1">سعر القطعة ({CURRENCY_SYMBOL})</label>
            <input type="number" id="itemPrice" name="price" value={currentItem.price > 0 ? currentItem.price : ''} onChange={handleCurrentItemChange} className="input-field" min="0" step="0.01" placeholder="0.00" />
          </div>
          <div>
            <label htmlFor="itemPacking" className="block text-sm font-medium text-gray-900 mb-1">التعبئة (قطع/كرتون)</label>
            <input type="number" id="itemPacking" name="packing" value={currentItem.packing > 0 ? currentItem.packing : ''} onChange={handleCurrentItemChange} className="input-field" min="0" placeholder="0" />
          </div>
          <div>
            <label htmlFor="itemCartons" className="block text-sm font-medium text-gray-900 mb-1">عدد الكراتين</label>
            <input type="number" id="itemCartons" name="cartons" value={currentItem.cartons > 0 ? currentItem.cartons : ''} onChange={handleCurrentItemChange} className="input-field" min="0" placeholder="0" />
          </div>
          <button
            onClick={handleAddItem}
            className="w-full md:col-span-1 lg:col-span-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 h-10"
          >
            إضافة عنصر
          </button>
        </div>
      </section>
      
      <style>{`
        .input-field {
          margin-top: 0.25rem;
          display: block;
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid #D1D5DB; /* gray-300 */
          border-radius: 0.375rem; /* rounded-md */
          box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); /* shadow-sm */
          background-color: #fff; /* Ensure white background for inputs */
          color: #111827; /* gray-900 for input text */
        }
        .input-field::placeholder {
          color: #9CA3AF; /* gray-400 for placeholder */
        }
        .input-field:focus {
          outline: none;
          border-color: #6366F1; /* indigo-500 */
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2); /* ring-indigo-500 with opacity */
        }
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield; /* Firefox */
        }
        /* Ensure labels in ImageInput are also dark */
        .image-input-label { 
            color: #111827; /* gray-900 */
        }
      `}</style>

      <section className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">قائمة البيع</h2>
        {items.length === 0 ? (
          <p className="text-gray-600">لم يتم إضافة أي عناصر بعد.</p>
        ) : (
          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={item.id} className="p-3 border border-gray-200 rounded-md flex items-center space-x-3 space-x-reverse bg-white shadow-sm">
                {item.imagePreview && (
                  <img src={item.imagePreview} alt={item.name} className="w-16 h-16 object-cover rounded-md border border-gray-200 flex-shrink-0" />
                )}
                <div className="flex-grow">
                  <h3 className="text-md font-semibold text-gray-900">{index + 1}. {item.name}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-2 gap-y-1 text-xs text-gray-800 mt-1">
                    <p><span className="font-medium">السعر:</span> {CURRENCY_SYMBOL}{item.price.toFixed(2)}</p>
                    <p><span className="font-medium">التعبئة:</span> {item.packing}</p>
                    <p><span className="font-medium">الكراتين:</span> {item.cartons}</p>
                    <p className="text-sm font-semibold text-green-700 md:text-right">
                      الإجمالي: {CURRENCY_SYMBOL}{item.subtotal.toFixed(2)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveItem(item.id)}
                  className="ml-auto flex-shrink-0 bg-red-500 text-white px-2 py-1 rounded-md hover:bg-red-600 text-xs"
                  aria-label={`حذف عنصر ${item.name}`}
                >
                  حذف
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <footer className="mt-8 pt-4 border-t-2 border-gray-300">
        <div className="text-right mb-6">
          <p className="text-2xl font-bold text-red-700">
            الإجمالي الكلي للفاتورة: {CURRENCY_SYMBOL} {grandTotal.toFixed(2)}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:justify-end sm:space-x-3 sm:space-x-reverse space-y-2 sm:space-y-0">
          <button
            onClick={handleSaveAsPng}
            disabled={isLoading || (items.length === 0 && !customerName.trim() && !merchantInfo.shopNumber.trim())}
            className="w-full sm:w-auto bg-purple-600 text-white px-6 py-2 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
          >
            {isLoading ? 'جاري الحفظ...' : 'حفظ كصورة PNG'}
          </button>
          <button
            onClick={handleSendToWhatsApp}
            disabled={isLoading || (items.length === 0 && !customerName.trim() && !merchantInfo.shopNumber.trim())}
            className="w-full sm:w-auto bg-teal-500 text-white px-6 py-2 rounded-md hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-400 disabled:opacity-50"
          >
            {isLoading ? 'جاري الإرسال...' : 'إرسال عبر WhatsApp'}
          </button>
        </div>
      </footer>
    </div>
  );
};

export default App;
