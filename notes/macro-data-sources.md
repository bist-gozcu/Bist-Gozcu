# Makro veri kaynakları ve semboller

Bu not, BIST Gözcü ana ekranındaki makro kartları için doğrulanan dış kaynak bilgilerini saklar.

- Yahoo Finance BIST 30: `XU030.IS` — https://finance.yahoo.com/quote/XU030.IS/
- Yahoo Finance BIST 50: `XU050.IS` — https://finance.yahoo.com/quote/XU050.IS/
- Yahoo Finance BIST 100: `XU100.IS` — https://finance.yahoo.com/quote/XU100.IS/
- Yahoo Finance USD/TRY: `USDTRY=X` — https://finance.yahoo.com/quote/USDTRY=X/
- Yahoo Finance EUR/TRY: `EURTRY=X` — https://finance.yahoo.com/quote/EURTRY=X/
- Yahoo Finance altın vadeli sürekli kontrat: `GC=F` — https://finance.yahoo.com/quote/GC%3DF/

Yahoo sayfaları BIST endekslerini TRY bazlı gecikmeli fiyat ve günlük değişimle, USD/TRY ve altın kontratını ilgili para birimiyle gösteriyor. Altın kartı bu nedenle açıkça “Altın / ons” ve USD birimiyle etiketlenmelidir; gram/TL gibi bir dönüşüm yapılmamalıdır.

Haberler için Yahoo Finance arama sonucu `search` verisindeki başlık, yayıncı, bağlantı ve yayın zamanı alanları kullanılacak; haber başlığı uygulamada kaynak ve bağlantıyla gösterilecek, AI özeti olmadan deterministik akış korunacaktır.

Kaynak arama kayıtları: Yahoo Finance BIST 30/50/100, USDTRY=X ve GC=F sayfaları; arama sonuçları 2026-08-19 tarihinde incelendi.
