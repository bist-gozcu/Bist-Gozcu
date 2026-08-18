# BIST Gözcü

BIST Gözcü, Borsa İstanbul hisselerini mobil ve web arayüzlerinde izlemek, teknik göstergeleri takip etmek ve açıklanabilir momentum taraması yapmak için hazırlanmış bir Expo uygulamasıdır. Uygulama yatırım tavsiyesi vermez; sinyaller geçmiş fiyat ve hacim verilerinden üretilen teknik göstergelerdir.

## Mimari

| Katman | Konum | Sorumluluk |
|---|---|---|
| Expo istemcisi | `artifacts/bist-gozcu` | Expo Router, React Native, React Native Web ve ekranlar |
| API sunucusu | `artifacts/api-server` | Yahoo Finance verisini quote ve OHLCV chart endpoint’leriyle sunar |
| Teknik analiz | `artifacts/bist-gozcu/utils/indicators.ts` | RSI, MACD, SMA, MFI, ATR ve analiz sonuçları |
| Trade motoru | `artifacts/bist-gozcu/services/treydMotoru.ts` | Ön tarama, tarihsel teyit ve açıklanabilir sinyal etiketi |

## Trade sinyali nasıl çalışır?

Önce yalnızca pozitif günlük değişim, fiyat ve göreceli hacim ile sınırlı bir aday listesi oluşturulur. Göreceli hacim mevcutsa hissenin üç aylık ortalama hacmine, yoksa veri kümesinin medyan hacmine göre hesaplanır ve aşırı hacim değerlerinin skoru tek başına domine etmemesi için sınırlandırılır.

Ardından en fazla altı aday için üç aylık günlük OHLCV geçmişi alınır. Aday; günlük trendin yükseliş olması, son 20 günlük direncin kırılması, tamamlanmış günlük bardaki göreceli hacmin en az `1,20x` olması, RSI’ın `50–72` aralığında bulunması, yüksek dip ve yüksek tepe yapısının birlikte oluşması, mevcut teknik analiz sinyalinin alım yönünde olması ve son tamamlanmış kapanışın pozitif kalması bakımından değerlendirilir.

> **GÜÇLÜ ALIM** etiketi artık yedi teyidin tamamı ve en az `%0,75` günlük pozitif değişim birlikte gerçekleşirse verilir. Direnç, hacim, RSI veya piyasa yapısı teyitlerinden biri eksikse sistem etiketi otomatik olarak zayıflatır veya `TAKİP LİSTESİ` gösterir. Tarihsel veri alınamazsa güçlü etiket kesinlikle üretilmez.

| Etiket | Anlamı |
|---|---|
| GÜÇLÜ ALIM | Günlük momentum ve yedi tarihsel/teknik teyit aynı yönde |
| MOMENTUM KIRILIMI | En az iki teyit var, ancak güçlü alım eşiği tamamlanmıyor |
| TAKİP LİSTESİ | Yeterli yön veya tarihsel teyit bulunmuyor |

## Favoriler ve menü

Favoriler `AsyncStorage` üzerinde `bist_favorites_v2` anahtarıyla saklanır. Uygulama açılırken depolama okunmadan önce yıldız işlemi yapılırsa geç gelen eski kayıt bu yeni işlemi ezemez. Eski `bist_favorites` anahtarı da bir defaya mahsus okunarak yeni anahtara taşınır. Favoriler artık veri yenilemesiyle silinmez. Portföy sekmesi alt menüden kaldırılmıştır; eski ekran dosyası geriye dönük geliştirme için depoda tutulmaktadır.

## Veri tazeliği

Piyasa açıkken önbellek süresi iki dakikaya indirilmiş ve otomatik yenileme etkinleştirilmiştir. Piyasa kapalıyken son başarılı veri on beş dakika boyunca kullanılabilir. Mobil istemci API proxy’sine ulaşamazsa mevcut Yahoo Finance fallback yolunu dener; web dağıtımında ise `EXPO_PUBLIC_DOMAIN` ile API servisinin alan adı mutlaka tanımlanmalıdır.

## Kurulum

Gereksinimler Node.js 22 veya üzeri, pnpm ve Expo Go’dur. Proje kökünde bağımlılıkları kurduktan sonra API servisini ve Expo istemcisini ayrı terminallerde çalıştırın:

```bash
pnpm install
pnpm --filter @workspace/api-server run dev
EXPO_PUBLIC_DOMAIN=localhost:3000 pnpm --filter @workspace/bist-gozcu exec expo start
```

API servisi `PORT` değişkenini zorunlu tutar. Geliştirme sırasında varsayılan örnek:

```bash
PORT=3000 pnpm --filter @workspace/api-server run dev
```

Expo Go için terminalde çıkan QR kodu taratın. Ağ erişimi sorunluysa tünel modunu kullanın:

```bash
EXPO_PUBLIC_DOMAIN=your-api-domain.example.com \
  pnpm --filter @workspace/bist-gozcu exec expo start --tunnel
```

Web ön izlemesi için:

```bash
EXPO_PUBLIC_DOMAIN=your-api-domain.example.com \
  pnpm --filter @workspace/bist-gozcu exec expo start --web
```

Gerekli ortam değişkenleri için [`.env.example`](.env.example) dosyasını temel alabilirsiniz. Gerçek gizli anahtarları GitHub’a göndermeyin.

## GitHub’a push

Remote adresiniz hazırsa proje kökünde şu komutları çalıştırın:

```bash
git remote add origin https://github.com/KULLANICI/DEPO.git
git branch -M main
git add -A
git commit -m "Improve favorites persistence and daily trade confirmations"
git push -u origin main
```

Her gün tek komutla güncellemek için `scripts/push-to-github.sh` kullanılabilir:

```bash
GITHUB_REPO_URL=https://github.com/KULLANICI/DEPO.git ./scripts/push-to-github.sh
```

İlk push sonrasında remote zaten kayıtlıysa yalnızca şu komut yeterlidir:

```bash
./scripts/push-to-github.sh
```

Script `--force` kullanmaz; mevcut geçmişi ezmeden normal branch push yapar. GitHub kimlik doğrulaması için HTTPS credential manager veya SSH anahtarı kullanın.

## Kontroller

| Kontrol | Sonuç |
|---|---|
| Expo TypeScript kontrolü | Başarılı |
| Expo web export | Başarılı |
| Expo Android export | Başarılı |
| API health endpoint | Başarılı |
| API quote endpoint | Başarılı; gerçek gecikmeli quote yanıtı alındı |
| Web Trade ön izlemesi | Başarılı; veri yükleniyor durumu düzeldi ve pozitif aday yoksa boş sonuç gösteriliyor |

## Bilinen sınırlar ve sonraki geliştirmeler

Yahoo Finance verisi gecikmeli veya geçici olarak erişilemez olabilir. Bu nedenle uygulamada tarihsel veri alınamadığında güçlü etiket üretilmez. Bir sonraki aşamada sinyal motorunun geçmiş sinyallerini saklayan bir backtest ekranı eklenmesi, başarı oranı ve yanlış pozitif oranının sembol ve piyasa rejimi bazında ölçülmesi önerilir. Ayrıca API tarafına sembol başına kısa süreli cache ve rate-limit koruması eklemek, altı adayın tarihsel teyit isteklerini daha dayanıklı hâle getirir.

## Lisans ve kullanım uyarısı

Kodun lisans politikasını GitHub’a göndermeden önce proje sahibinin tercihine göre netleştirin. Uygulamadaki fiyat, gösterge ve sinyal bilgileri eğitim ve bilgilendirme amaçlıdır; yatırım tavsiyesi değildir.

### Kaynaklar

- [Expo Documentation](https://docs.expo.dev/)
- [Expo Router Documentation](https://docs.expo.dev/router/introduction/)
- [Yahoo Finance chart endpoint yaklaşımı](https://developer.yahoo.com/api/)


> Ön izleme notu: Web testinde Portföy sekmesi alt menüden kaldırıldı. Treyd kartlarında günlük trend, direnç kırılımı, RVOL hacim, RSI, yüksek dip, yüksek tepe ve yapı teyidi ayrı ayrı gösterildi. Örneğin bazı adaylarda direnç/hacim/RSI teyidi bulunmasına rağmen günlük trend veya piyasa yapısı eksik olduğu için etiket `GÜÇLÜ ALIM` seviyesine yükselmedi.
