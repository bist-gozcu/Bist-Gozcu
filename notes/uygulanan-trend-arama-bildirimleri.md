# BIST Gözcü — Uygulanan Trend, Arama ve Bildirim Değişiklikleri

Tarih: 22 Ağustos 2026

## Uygulananlar

- Kullanıcıya görünen Treyd adı `TREND` olarak değiştirildi.
- Trend Radarı yalnızca 21 Ağustos 2026 snapshot’ı ile BIST 50 evreninden aday alıyor.
- BIST 30 hisseleri sıralamada önceliklendiriliyor.
- Minimum ortalama işlem değeri 5.000.000 TL olarak likidite kapısı eklendi.
- Tarihsel verisi veya ortalama hacmi doğrulanamayan adaylar radar dışında bırakılıyor.
- Yalnızca en az 5/6 teknik teyit alan sinyaller ana radar ekranında gösteriliyor.
- 6/6 teyitli adaylar güçlü teyit olarak korunuyor.
- Arama ekranı yerel katalogda olmayan sembolü proxy/grafik fallback’i ile tekil olarak doğrulayabiliyor.
- Doğrulanan harici semboller favoriye eklenebiliyor ve dinamik quote önbelleğine dahil ediliyor.
- Favori ve takip listesi, sabit hisse kataloğu dışındaki doğrulanmış sembolleri de kalıcı olarak tutabiliyor.
- Hisse kartına `TradingView’da temel analizi aç` bağlantısı eklendi.
- Yeni 5/6 veya 6/6 Trend Radar girişleri için, aynı gün aynı seviyede tekrar etmeyen kısa yerel bildirim eklendi.
- Sabit katalog BIST 50’nin eksik kalan bileşenleriyle genişletildi ve duplicate quote çağrıları azaltıldı.

## Doğrulama

- Workspace TypeScript kontrolü başarılı.
- Android `expo export --platform android` başarılı.
- Git diff biçim kontrolü başarılı.

## Bilinen sınır

- `/bist/stock/:symbol/overview` rotası kaynak kodunda mevcut olsa da kalıcı Replit deployment’ında hâlâ yayınlanmadı; Replit ücretsiz kota sorunu nedeniyle temel oran/haber kartının canlı veri akışı ayrıca deploy edilmelidir.
- TradingView bağlantısı bu açığı güvenli biçimde telafi eder; veriler TradingView sayfasında açılır, uygulama TradingView verisini otomatik kazımaz.
- Trend bildirimleri şu aşamada uygulama taraması yapıldığında yerel olarak üretilir; uygulama tamamen kapalıyken arka planda otomatik tarama/push servisi değildir.
- BIST 30/50 üyelikleri dönemsel değiştiği için snapshot tarihi uygulama içinde güncellenmelidir.

## Kaynak

BIST 30/50 sembol snapshot’ı, 21–22 Ağustos 2026 tarihli kamuya açık BIST 30/50 bileşen sayfalarından çapraz kontrol edilmiştir. Endeks üyeliği ve piyasa verileri yatırım kararı garantisi değildir.

## Sonraki adım

Commit ve GitHub push sonrasında Windows klasöründe `pnpm install` ve preview kanalına OTA yayınlanmalıdır.

Şimdilik kullanıcıya özel isim eklenmemiştir.

POSIX not sonu.

