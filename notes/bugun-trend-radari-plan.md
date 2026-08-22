# BIST Gözcü — Bugünkü Konuşma ve Sonraki Değişiklikler

Tarih: 21 Ağustos 2026

## Çalışma kuralı

Bu notta yer alan tasarım kararları kullanıcı tarafından onaylanmıştır. Şimdilik kod değişikliği, yeni APK veya OTA yayını yapılmayacak. Maddeler en son birlikte uygulanacak, ardından typecheck, export ve gerçek cihaz kontrolü yapılacaktır.

## Bugün tamamlanan mevcut durum

- Treyd teyit sayısı 7/7 yerine gerçek motor yapısına uygun 5/6 ve 6/6 olarak düzeltildi.
- `expo-router` export hatası teşhis edildi. `expo-router` için zorunlu peer bağımlılıkları olan `expo-linking` ve `expo-constants` geri eklendi.
- Android export sandbox’ta başarıyla doğrulandı.
- Export düzeltmesi GitHub’a `240cdfd` commit’iyle push edildi.
- OTA güncellemesi preview kanalına başarıyla yayınlandı; ekranda `Published!` görüldü.
- Mevcut kurulu Android uygulaması için bu export düzeltmesinde yeniden APK kurmak gerekmiyor; OTA güncellemesi yeterli.

## İsim kararı

Uygulamadaki “Treyd” veya “Trade” adı yerine **TREND** kullanılacak. “Trent” doğru yazım değildir. Ekran başlığı için tercih edilen seçenekler:

- Ana başlık: **TREND**
- Alternatif başlık: **Trend Radarı**
- Alt açıklama: **BIST 30/50 içinde likit, çoklu teyitli trend ve kırılım taraması**

“Trade” alım-satım işlemi anlamına gelir; mevcut motor doğrudan işlem gerçekleştirmediği için “Trend” adı yaptığı analize daha uygundur.

## Ana amaç

Uygulama kesin yükselecek hisse söylemeyecek. Amaç; **yükseliş ihtimali ve trend devamlılığı daha yüksek olabilecek, likit ve teknik olarak desteklenen hisseleri** tek günlük sert yükselişlerden ayırarak hisse seçiminde yardımcı olmaktır.

## Radar ekranındaki temel düzeltme

Günlük yüzde değişim yalnızca aday havuzu oluşturacak; ana radara giriş için yeterli olmayacak. Çünkü bir hissenin bugün yüzde 7–10 yükselmesi, trendinin devam edeceğini kanıtlamaz.

Örnek olarak görüntülenen BERA’da +%7,76 yükselişe rağmen yalnızca 1/6 teyit bulunuyor: trend yatay, direnç kırılmamış, RVOL 0,78x ve RSI 49. Bu durum “bugün yükseldi fakat devam teyidi yok” şeklinde sınıflandırılmalı. NETAS’ta +%9,14 hareket; yukarı trend, direnç kırılımı, yüksek RVOL ve MACD gibi ek teyitlerle desteklendiği için 5/6 alıyor.

Ana **Trend Radarı** bölümünde yalnızca en az 5/6 teyit alanlar gösterilecek. 6/6 alanlar ayrıca “Güçlü teyit” etiketi alacak. 0–4/6 alan hisseler ana radarın içine karıştırılmayacak; istenirse ayrı ve pasif bir bölümde **“Günlük yükseldi — teyitsiz”** olarak gösterilecek.

## Üç radar sınıfı

| Sınıf | Temel koşul | Kullanıcıya anlatacağı anlam |
|---|---|---|
| Trend devamı | En az 5/6 teyit, trend yukarı, likidite uygun | Mevcut yükselişin devamı izlenebilir |
| Yeni kırılım | Direnç yeni kırılmış, hacim artmış, RSI aşırı şişmemiş | Yeni hareket başlıyor olabilir; teyit takip edilmeli |
| Yükseldi fakat teyitsiz | Günlük artış yüksek, fakat 0–4/6 teyit | Fiyat yükseldi ancak devam sinyali oluşmadı |

## Hisse evreni ve öncelik

Treyd taraması öncelikle **BIST 30**, ardından BIST 30 dışında kalan **BIST 50** hisseleriyle sınırlandırılacak. BIST 30 hisseleri aynı kalite puanına sahip olduğunda öncelikli sıralanacak. Endeks üyelikleri dönemsel değiştiği için liste tarihli snapshot olarak tutulacak ve gerektiğinde güncellenecek; sahte veya doğrulanmamış üyelik bilgisi eklenmeyecek.

## Sığ ve manipülasyona açık hareketleri azaltma

Endeks üyeliği tek başına yeterli güvence sayılmayacak. Ana radar öncesinde şu likidite kontrolleri uygulanacak:

| Kontrol | Amaç |
|---|---|
| Üç aylık ortalama hacim mevcut ve sıfırdan büyük mü? | Eksik veya sağlıksız veriyi elemek |
| Ortalama işlem değeri yeterli mi? | Sadece lot sayısına bakmanın yanılmasını önlemek |
| RVOL çok düşük mü? | Zayıf katılımla oluşan hareketi elemek |
| Fiyat serisi düzenli mi? | Kesintili veri veya anlamsız grafikleri elemek |
| Çok yüksek günlük artış var fakat direnç kırılmamış mı? | Tek günlük sıçramayı ayırmak |
| Hisse uzun yatay dönemden sonra tek günde mi hareket etti? | Sığ/spekülatif hareket riskini işaretlemek |

Düşük fiyatlı olmak veya çok sayıda lot işlem görmek tek başına yüksek likidite kabul edilmeyecek. TL işlem değeri, ortalama hacim, RVOL ve hareketin sürekliliği birlikte değerlendirilecek.

## Korunacak 6 bağımsız teyit

Teyit motorunda mevcut 6 bağımsız koşul korunacak ve aynı koşul iki defa sayılmayacak:

1. Trend: fiyat ve hareketli ortalamalar yukarı yönde.
2. Direnç: önemli günlük/haftalık direnç üzerinde kapanış.
3. Hacim: kırılımı destekleyen göreceli hacim.
4. RSI: tercihen 55–70 arası; 70 üzeri ayrıca aşırı ısınma riski.
5. Fiyat yapısı: yüksek dip ve yüksek tepe yapısının devamı.
6. MACD: pozitif ve yükselen momentum.

Bunlara eklenen risk bayrakları teyit sayısını artırmayacak. RSI’ın aşırı yükselmesi, fiyatın ATR’ye göre fazla uzaklaşması, gün içi zirveden uzak kapanış veya düşük RVOL gibi durumlar sıralamayı aşağı çekecek ve kartta açıkça gösterilecek.

## Puanlama ve sıralama

Teyit sayısı ile kalite/risk puanı birbirinden ayrılacak. Önce minimum 5/6 eşiği uygulanacak, sonra sonuçlar şu sırayla sıralanacak:

- BIST 30 önceliği.
- BIST 50 üyeliği.
- Likidite kalitesi.
- Direnç kırılımı ve hacim desteği.
- Trendin çoklu zaman dilimlerinde uyumu.
- Aşırı yükselme ve geri verme riski.
- Genel BIST piyasa yönü.

6/6 alan her hisse otomatik olarak birinci sıraya konmayacak. Örneğin RSI çok aşırı yükselmişse veya fiyat ATR’ye göre fazla uzaklaşmışsa risk etiketiyle aşağı sıralanabilecek. 5/6 alan fakat daha dengeli ve likit bir hisse daha sağlıklı izleme adayı olabilir.

## Kartlarda gösterilecek ifade örnekleri

NETAS benzeri bir hisse:

> NETAS — Trend devamı  
> 5/6 teyit · BIST 30 önceliği · RVOL yüksek · Risk: RSI yüksek

BERA benzeri bir hisse:

> BERA — Yükseldi fakat teyitsiz  
> 1/6 teyit · Trend yatay · RVOL düşük · Direnç kırılmadı

## Doğrulama ve ölçüm

Değişiklikler uygulanmadan veya başarılı kabul edilmeden önce geçmiş veride en az 1, 5 ve 10 işlem günü sonraki sonuçlar ölçülecek. Ayrıca 5/6 ve 6/6 adayların devam oranı, tek günlük yükselişlerin ertesi gün geri verme oranı, BIST 30–BIST 50 farkı, yanlış sinyal oranı ve maksimum düşüş izlenecek. Bu testler geleceği garanti etmeyecek; yalnızca kuralların geçmişte nasıl davrandığını gösterecek.

## Uygulama sırası

1. Ekran adını TREND/Trend Radarı olarak değiştirmek.
2. BIST 30 ve BIST 50 tarihli evrenini eklemek veya güncellemek.
3. Likidite ve sığ hareket ön filtresini eklemek.
4. 0–4/6 adayları ana radardan ayırmak.
5. Trend devamı ve yeni kırılım sınıflarını oluşturmak.
6. Risk bayraklarını ve açıklayıcı kart metinlerini eklemek.
7. TypeScript, export ve cihaz üzerinde sonuç kontrolü yapmak.
8. Kullanıcı onayından sonra tek commit ve OTA yayınlamak.

## Kapsam dışı

Şimdilik Fintables’tan izinsiz veri alma, garanti edilmiş alım-satım önerisi üretme, otomatik emir gönderme ve kullanıcı adına işlem yapma kapsam dışıdır.

Bu not, daha sonra yapılacak toplu kod değişikliğinin kabul kriteridir.
