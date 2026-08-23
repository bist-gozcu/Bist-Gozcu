# Günlük Trade bölümü ve GitHub kullanım notu

## Uygulanan ekran değişikliği

TREND ekranının en altına `Günlük Trade Adayları` bölümü eklendi. Bölüm, ana radarın mevcut sonuçlarını kullanır; yani yalnızca BIST 50 evreninden, likidite filtresinden geçen ve en az 5/6 günlük teyit alan sonuçları gösterir. Kartlarda tekrar teknik açıklama yazılmaz; yalnızca hisse sembolleri sade düğmeler halinde gösterilir. Sembole dokunulduğunda ilgili hisse kartı açılır.

## Doğrulama

Workspace TypeScript kontrolü başarılıdır. `git diff --check` başarılıdır. Android Expo export başarılıdır. Yeni native paket eklenmemiştir; değişiklik mevcut preview runtime 1.0.0 uygulamasına OTA ile gönderilebilir.

## GitHub Free bilgisi

GitHub Free kişisel hesaplarda sınırsız public ve private repository kullanılabilir; private repository özellikleri plan kapsamında sınırlı olabilir. GitHub Free için resmi dokümanda GitHub Actions kullanımına ayda 2.000 dakika, GitHub Packages için 500 MB ve Codespaces için ayda 120 çekirdek saat bilgisi verilmektedir.

Repository sınırları açısından GitHub, `.git` klasörü için disk üzerinde 10 GB içinde kalmayı önerir. Tek bir Git nesnesi için önerilen üst sınır 1 MB, uygulanan sert sınır 100 MB'dır; tek bir push 2 GB ile sınırlıdır. Push işlemleri için önerilen hız repository başına dakikada 6 push'tur. Bu projede normal kaynak kodu commit/push işlemleri GitHub Free kullanımını tüketen bir aylık kota değildir; Actions workflow çalıştırılmadığı sürece aylık Actions dakikası da harcanmaz. APK, `node_modules`, export çıktıları ve büyük binary dosyalar GitHub repository'sine konulmamalıdır.

### Kaynaklar

- https://docs.github.com/en/get-started/learning-about-github/githubs-plans
- https://docs.github.com/en/repositories/creating-and-managing-repositories/repository-limits
- https://docs.github.com/en/actions/reference/limits
- https://docs.github.com/en/actions/concepts/billing-and-usage
