# BIST Gözcü

Borsa İstanbul hisselerini gerçek zamanlı takip edin, portföyünüzü yönetin ve akıllı alarmlarla piyasayı izleyin.

## 🚀 Özellikler

- **BIST 100 Hisseleri** — Tüm BIST hisselerini gerçek zamanlı fiyatlarla takip edin
- **Favoriler** — İlgilendiğiniz hisseleri favorilere ekleyin
- **Portföy Yönetimi** — Hisse alım-satım işlemlerinizi kaydedin, kar/zarar takibi yapın
- **Alarmlar** — Fiyat hedeflerine ulaştığında bildirim alın
- **Piyasa Özeti** — BIST 30, BIST 50 endeks özeti ve kripto fiyatları
- **TREND Motoru** — Teknik analiz sinyalleri ve trend tespiti
- **Grafikler** —İnteraktif mum grafikleri (1G, 1H, 1A, 3A, 1Y, 5Y)
- **Temel Analiz** — F/K, PD/DD, ROE gibi temel oranlar (geliştirme aşamasında)
- **Koyu Tema** — Tam koyu mod desteği

## 📱 Teknoloji Yığını

| Teknoloji | Versiyon |
|-----------|----------|
| Expo | 54 |
| React Native | 0.81 |
| TypeScript | 5.9 |
| expo-router | 6 |
| TanStack React Query | 5 |
| react-native-svg | 15.12 |
| expo-notifications | 0.32 |
| Zod | 3.25 |

## 🛠️ VS Code ile Geliştirme

### Ön Koşullar

1. **Node.js 20+** — [nodejs.org](https://nodejs.org/)
2. **VS Code** — [code.visualstudio.com](https://code.visualstudio.com/)
3. **Expo Go** (iOS/Android) — Test için mobil cihazınızda
4. **Android Studio** (isteğe bağlı) — Emülatör için

### Kurulum

```bash
# Repoyu klonlayın
git clone https://github.com/KULLANICIADINIZ/bist-gozcu.git
cd bist-gozcu

# Bağımlılıkları yükleyin
npm install

# Ortam değişkenlerini ayarlayın
cp .env.example .env
# .env dosyasını düzenleyerek API proxy adresini belirtin

# Geliştirme sunucusunu başlatın
npm start
```

### VS Code Eklentileri

Projeyi VS Code ile açtığınızda, önerilen eklentileri kurmanız istenir:
- **Expo Tools** — Expo geliştirme entegrasyonu
- **React Native Tools** — Hata ayıklama desteği
- **ESLint** — Kod kalitesi
- **Prettier** — Kod biçimlendirme

### Yararlı Komutlar

```bash
npm start           # Geliştirme sunucusu başlat
npm run android     # Android'de çalıştır
npm run ios         # iOS'ta çalıştır
npm run web         # Web'de çalıştır
npm run typecheck   # TypeScript tip kontrolü
npm run lint        # ESLint kod kontrolü
```

## 🔧 GitHub Actions CI/CD

### Sürekli Entegrasyon (CI)
- **Her PR'da** — TypeScript tip kontrolü + ESLint
- **main branch'e push** — Preview APK oluşturma
- **develop branch'e push** — Development APK oluşturma

### Otomatik Sürüm Yayınlama
1. `v*` formatında tag oluşturun: `git tag v1.1.0`
2. Tag'ı itin: `git push origin v1.1.0`
3. GitHub Actions otomatik olarak:
   - Production AAB oluşturur
   - GitHub Release oluşturur
   - OTA güncelleme yayınlar

### Gerekli GitHub Secrets

| Secret | Açıklama |
|--------|----------|
| `EXPO_TOKEN` | EAS Build için Expo access token |

**Expo Token alma:**
1. [expo.dev](https://expo.dev/) → Account Settings → Access Tokens
2. "Generate new token" → Token'ı kopyalayın
3. GitHub repo → Settings → Secrets → Actions → New secret
4. Name: `EXPO_TOKEN`, Value: token'ınız

## 📁 Proje Yapısı

```
bist-gozcu/
├── .github/workflows/   # CI/CD pipeline'ları
├── app/                  # Expo Router sayfaları
│   ├── (tabs)/           # Ana sekmeler
│   └── stock/[symbol].tsx # Hisse detay sayfası
├── components/           # Yeniden kullanılabilir bileşenler
├── constants/            # Sabit veriler (BIST hisseleri, renkler)
├── contexts/             # React Context sağlayıcıları
├── hooks/                # Özel React hooks
├── services/             # API servisleri
├── utils/                # Yardımcı fonksiyonlar
├── server/               # Proxy sunucu
└── assets/               # Görseller ve fontlar
```

## 🔄 Geliştirme Yol Haritası

### ✅ Phase 1 — Temel İyileştirmeler (Tamamlandı)
- [x] Proxy URL ortam değişkenine taşındı
- [x] Replit bağımlılıkları temizlendi
- [x] Yinelenen hisseler kaldırıldı (AEFES, ENKAI, GUBRF, ASTOR)
- [x] Gizli sekmeler görünür yapıldı (Portföy, Alarmlar)
- [x] Merkezi hata loglama altyapısı oluşturuldu (logger.ts)
- [x] GitHub Actions CI/CD kuruldu

### 🔲 Phase 2 — Performans
- [ ] StockContext yenileme optimizasyonu (sadece görünür hisseler)
- [ ] fetchBatchQuotes paralel istek sınırlama (chunk=24, concurrency=4)
- [ ] React.memo ile bileşen render optimizasyonu
- [ ] FlatList performansı (windowSize, removeClippedSubviews)

### 🔲 Phase 3 — Temel Analiz & Doğrulama
- [ ] Zod şemaları ile API yanıt doğrulama
- [ ] Temel oranlar endpoint'ini aktif et (fetchHisseTemelDetay)
- [ ] Sentry hata takip entegrasyonu
- [ ] Birim testleri (Jest + React Testing Library)

### 🔲 Phase 4 — UX & Yayınlama
- [ ] iOS TestFlight desteği
- [ ] Google Play Store yayınlama
- [ ] Uygulama içi güncelleme bildirimleri
- [ ] Erişilebilirlik (Accessibility) iyileştirmeleri

## 📄 Lisans

MIT
