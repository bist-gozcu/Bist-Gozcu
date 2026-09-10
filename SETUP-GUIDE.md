# BIST Gözcü — GitHub + VS Code Kurulum Rehberi

Bu rehber, projeyi GitHub'a yükleyip VS Code ile geliştirmeye başlamanız için adım adım talimatlar içerir.

---

## 📋 Adım 1: GitHub Repository Oluşturma

1. [github.com](https://github.com/) → **New repository**
2. Repository adı: `bist-gozcu`
3. Açıklama: `Borsa İstanbul gerçek zamanlı hisse takip uygulaması`
4. **Public** veya **Private** seçin
5. **Initialize with README** kutusunu **BOŞ bırakın** (zaten README var)
6. **Create repository** tıklayın

## 📋 Adım 2: GitHub'a İtme

Terminal'de (VS Code içinde `Ctrl+\`` ile açabilirsiniz):

```bash
# Proje dizinine gidin
cd bist-gozcu

# GitHub remote'ı ekleyin (KULLANICIADINIZ yerine kendi adınızı yazın)
git remote add origin https://github.com/KULLANICIADINIZ/bist-gozcu.git

# Kodu GitHub'a itin
git push -u origin main
```

### İlk Push'ta Kimlik Doğrulama

GitHub artık parola kimlik doğrulamasını desteklemiyor. Aşağıdaki yöntemlerden birini kullanın:

**Yöntem A: Personal Access Token (Önerilen)**
1. GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. "Generate new token" → Repository erişim izni verin
3. Push sırasında parola olarak token'ı kullanın

**Yöntem B: SSH Anahtarı**
1. `ssh-keygen -t ed25519 -C "github@email.com"`
2. `~/.ssh/id_ed25519.pub` içeriğini GitHub → Settings → SSH keys'e ekleyin
3. Remote URL'yi değiştirin: `git remote set-url origin git@github.com:KULLANICIADINIZ/bist-gozcu.git`

## 📋 Adım 3: GitHub Secrets Ayarlama (CI/CD için)

GitHub repository'nize gidin → **Settings** → **Secrets and variables** → **Actions**

### Gerekli Secret: EXPO_TOKEN

1. [expo.dev](https://expo.dev/) → Account Settings → Access Tokens
2. **Generate new token** → İsim: `GitHub Actions` → Token'ı kopyalayın
3. GitHub'da **New repository secret**:
   - Name: `EXPO_TOKEN`
   - Value: Kopyaladığınız token

## 📋 Adım 4: VS Code ile Geliştirme

### Uzantıları Kurma

VS Code ile projeyi açtığınızda, otomatik önerilen uzantıları kurun:
- ✅ Expo Tools
- ✅ React Native Tools
- ✅ ESLint
- ✅ Prettier

### Geliştirme Sunucusunu Başlatma

```bash
# Bağımlılıkları yükle
npm install

# Ortam değişkenlerini ayarla
cp .env.example .env

# Geliştirme sunucusunu başlat
npm start
```

**QR Kod ile Mobil Test:**
1. Telefonunuzda **Expo Go** uygulamasını açın
2. `npm start` sonrası görünen QR kodu tarayın
3. Uygulama telefonunuzda açılacaktır

**Emülatör ile Test:**
- Android: `npm run android` (Android Studio gerekli)
- iOS: `npm run ios` (Xcode gerekli, yalnızca macOS)
- Web: `npm run web`

### Sık Kullanılan VS Code Kısayolları

| İşlem | Kısayol |
|-------|----------|
| Terminal aç | `Ctrl+\`` |
| Dosya arama | `Ctrl+P` |
| Komut paleti | `Ctrl+Shift+P` |
| Git değişiklikleri | `Ctrl+Shift+G` |

## 📋 Adım 5: Geliştirme Akışı

### Branch (Dal) Stratejisi

```
main        ← Kararlı sürüm (production)
  └── develop  ← Günlük geliştirme
       └── feature/xxx  ← Yeni özellik geliştirme
```

### Yeni Özellik Geliştirme

```bash
# develop dalından yeni özellik dalı oluştur
git checkout -b feature/temel-analiz develop

# Kod yaz, değişiklik yap...

# Değişiklikleri kaydet
git add .
git commit -m "feat: temel analiz bölümü eklendi"

# GitHub'a it
git push origin feature/temel-analiz

# GitHub'da Pull Request oluştur: feature/temel-analiz → develop
``n
### Sürüm Yayınlama

```bash
# Versiyon numarasını güncelle
# package.json → "version": "1.1.0"
# app.json → "version": "1.1.0"

git add .
git commit -m "chore: v1.1.0 sürüm hazırlığı"

# Tag oluştur ve it
git tag v1.1.0
git push origin main --tags

# GitHub Actions otomatik olarak:
# 1. Production AAB oluşturur
# 2. GitHub Release oluşturur
# 3. OTA güncelleme yayınlar
```

## 🔧 GitHub Actions Pipeline'ları

### CI (Sürekli Entegrasyon)
- **Her PR'da**: TypeScript tip kontrolü + ESLint
- **Dosya**: `.github/workflows/ci.yml`

### EAS Build (Otomatik APK)
- **main'e push**: Preview APK
- **develop'a push**: Development APK
- **v* tag'ı**: Production AAB
- **Dosya**: `.github/workflows/eas-build.yml`

### Release (Otomatik Yayınlama)
- **v* tag'ı itildiğinde**: GitHub Release + OTA güncelleme
- **Dosya**: `.github/workflows/release.yml`

---

## ⚡ Hızlı Başlangıç (TL;DR)

```bash
git clone https://github.com/KULLANICIADINIZ/bist-gozcu.git
cd bist-gozcu
npm install
cp .env.example .env
npm start
```

---

## 🆘 Sorun Giderme

### `npm install` hatası
- Node.js 20+ kullandığınızdan emin olun: `node -v`
- Önbelleği temizleyin: `npm cache clean --force && rm -rf node_modules && npm install`

### Metro bundle hatası
- Önbelleği temizleyin: `npx expo start --clear`

### GitHub Actions build hatası
- `EXPO_TOKEN` secret'ının doğru ayarlandığını kontrol edin
- EAS project ID'nin app.json ile eşleştiğini doğrulayın

### Proxy bağlantı hatası
- `.env` dosyasında `EXPO_PUBLIC_DOMAIN` değerini kontrol edin
- Proxy sunucusunun çalıştığından emin olun
