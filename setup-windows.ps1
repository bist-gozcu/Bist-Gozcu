# ==============================================================================
# BIST GÖZCÜ — Otomatik Kurulum Betiği (Windows PowerShell)
# ==============================================================================
# Bu betik şunları yapar:
#   1. Ön koşulları kontrol eder (Git, Node.js)
#   2. npm bağımlılıklarını kurar
#   3. .env dosyasını oluşturur
#   4. Git repo başlatır ve ilk commit atar
#   5. GitHub remote ekler (kullanıcı adını sorar)
#   6. Kodu GitHub'a push'lar
#   7. EAS Build ile APK derler
# ==============================================================================

$ErrorActionPreference = "Stop"

# ── Renkli yazı fonksiyonları ──────────────────────────────────────────────────
function Write-Step { param([string]$msg) Write-Host "\n>>> $msg" -ForegroundColor Cyan }
function Write-OK   { param([string]$msg) Write-Host "  ✓ $msg" -ForegroundColor Green }
function Write-Warn { param([string]$msg) Write-Host "  ⚠ $msg" -ForegroundColor Yellow }
function Write-Err { param([string]$msg) Write-Host "  ✗ $msg" -ForegroundColor Red }

# ── Proje dizini ──────────────────────────────────────────────────────────────
$ProjectDir = "C:\Users\CAREKİ\Bist-Gozcu-43384ba\artifacts\bist-gozcu"

if (-not (Test-Path $ProjectDir)) {
    Write-Err "Proje dizini bulunamadı: $ProjectDir"
    Write-Host "Lütfen doğru yolu girin:"
    $ProjectDir = Read-Host "Proje dizini"
}

Set-Location $ProjectDir
Write-OK "Proje dizini: $ProjectDir"

# ── 1. Ön koşullar ────────────────────────────────────────────────────────────
Write-Step "1/7 — Ön koşullar kontrol ediliyor..."

# Git
try {
    $gitVer = git --version 2>&1
    Write-OK "Git: $gitVer"
} catch {
    Write-Err "Git yüklü değil! https://git-scm.com/download/win adresinden yükleyin."
    exit 1
}

# Node.js
try {
    $nodeVer = node --version 2>&1
    Write-OK "Node.js: $nodeVer"
    if ($nodeVer -match "v(\d+)") {
        $major = [int]$Matches[1]
        if ($major -lt 18) {
            Write-Err "Node.js 18+ gerekli! Mevcut: $nodeVer"
            Write-Host "https://nodejs.org adresinden LTS sürümü yükleyin."
            exit 1
        }
    }
} catch {
    Write-Err "Node.js yüklü değil! https://nodejs.org adresinden yükleyin."
    exit 1
}

# npm
try {
    $npmVer = npm --version 2>&1
    Write-OK "npm: v$npmVer"
} catch {
    Write-Err "npm yüklü değil! Node.js ile birlikte gelir."
    exit 1
}

# ── 2. npm bağımlılıkları ─────────────────────────────────────────────────────
Write-Step "2/7 — npm bağımlılıkları kuruluyor..."
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Err "npm install başarısız!"
    exit 1
}
Write-OK "Bağımlılıklar kuruldu."

# ── 3. .env dosyası ──────────────────────────────────────────────────────────
Write-Step "3/7 — .env dosyası oluşturuluyor..."

if (Test-Path ".env") {
    Write-Warn ".env dosyası zaten var, değiştirilmiyor."
} else {
    Copy-Item ".env.example" ".env"
    Write-OK ".env dosyası .env.example'dan kopyalandı."
    Write-Host "  Varsayılan proxy domain: bist-gozcu--careki73.replit.app"
    Write-Host "  Değiştirmek isterseniz .env dosyasını düzenleyin."
}

# ── 4. Git başlatma ───────────────────────────────────────────────────────────
Write-Step "4/7 — Git repo başlatılıyor..."

$gitInitialized = Test-Path ".git"
if ($gitInitialized) {
    Write-Warn "Git repo zaten var."
} else {
    git init
    git add -A
    git commit -m "feat: Phase 1 — Replit bağımlılıkları temizlendi, CI/CD kuruldu"
    Write-OK "Git repo başlatıldı ve ilk commit atıldı."
}

# Branch adını main yap
git branch -M main 2>$null

# ── 5. GitHub remote ─────────────────────────────────────────────────────────
Write-Step "5/7 — GitHub remote ekleniyor..."

$existingRemote = git remote get-url origin 2>$null
if ($existingRemote) {
    Write-Warn "Remote zaten var: $existingRemote"
} else {
    Write-Host ""
    Write-Host "  ┌──────────────────────────────────────────────────────────┐" -ForegroundColor Yellow
    Write-Host "  │  ÖNCE GitHub'da repo oluşturun:                           │" -ForegroundColor Yellow
    Write-Host "  │                                                          │" -ForegroundColor Yellow
    Write-Host "  │  1. https://github.com/new adresine gidin                │" -ForegroundColor Yellow
    Write-Host "  │  2. Repo adı: bist-gozcu                                 │" -ForegroundColor Yellow
    Write-Host "  │  3. Public veya Private seçin                            │" -ForegroundColor Yellow
    Write-Host "  │  4. README/.gitignore EKLEMEYİN (bizde zaten var)         │" -ForegroundColor Yellow
    Write-Host "  │  5. Create Repository deyin                               │" -ForegroundColor Yellow
    Write-Host "  └──────────────────────────────────────────────────────────┘" -ForegroundColor Yellow
    Write-Host ""
    
    $githubUser = Read-Host "GitHub kullanıcı adınız"
    $repoUrl = "https://github.com/$githubUser/bist-gozcu.git"
    git remote add origin $repoUrl
    Write-OK "Remote eklendi: $repoUrl"
}

# ── 6. GitHub'a push ────────────────────────────────────────────────────────
Write-Step "6/7 — GitHub'a push'lanıyor..."

$pushConfirm = Read-Host "GitHub'a push'lamak ister misiniz? (y/n)"
if ($pushConfirm -eq 'y' -or $pushConfirm -eq 'Y') {
    git push -u origin main
    if ($LASTEXITCODE -eq 0) {
        Write-OK "Kod GitHub'a push'landı!"
    } else {
        Write-Err "Push başarısız! GitHub'da repo oluşturduğunuza emin olun."
        Write-Host "  Tekrar denemek için: git push -u origin main"
        exit 1
    }
} else {
    Write-Warn "Push atlandı. Sonra manuel olarak çalıştırın: git push -u origin main"
}

# ── 7. EAS Build (APK) ───────────────────────────────────────────────────────
Write-Step "7/7 — EAS Build kurulumu..."

Write-Host ""
Write-Host "  ┌──────────────────────────────────────────────────────────┐" -ForegroundColor Cyan
Write-Host "  │  APK derlemek için 2 seçeneğiniz var:                    │" -ForegroundColor Cyan
Write-Host "  │                                                          │" -ForegroundColor Cyan
Write-Host "  │  A) OTOMATİK (GitHub Actions):                            │" -ForegroundColor Cyan
Write-Host "  │     main branch'ine push → otomatik APK derlenir          │" -ForegroundColor Cyan
Write-Host "  │     (EXPO_TOKEN secret'i gerekli)                         │" -ForegroundColor Cyan
Write-Host "  │                                                          │" -ForegroundColor Cyan
Write-Host "  │  B) MANUEL (EAS CLI):                                    │" -ForegroundColor Cyan
Write-Host "  │     npx expo login                                       │" -ForegroundColor Cyan
Write-Host "  │     eas build --platform android --profile preview        │" -ForegroundColor Cyan
Write-Host "  │                                                          │" -ForegroundColor Cyan
Write-Host "  │  Her iki yöntem de Preview APK (test için) üretir.        │" -ForegroundColor Cyan
Write-Host "  └──────────────────────────────────────────────────────────┘" -ForegroundColor Cyan
Write-Host ""

$buildChoice = Read-Host "Şimdi manuel APK derlemek ister misiniz? (y/n)"
if ($buildChoice -eq 'y' -or $buildChoice -eq 'Y') {
    Write-Step "Expo login kontrol ediliyor..."
    $expoLogin = npx expo whoami 2>&1
    if ($expoLogin -match "not logged in") {
        Write-Host "Expo hesabına giriş yapmanız gerekiyor:"
        npx expo login
    }
    Write-OK "Expo giriş yapıldı: $(npx expo whoami 2>&1)"
    
    Write-Step "Preview APK derleniyor (bu birkaç dakika sürebilir)..."
    eas build --platform android --profile preview
    if ($LASTEXITCODE -eq 0) {
        Write-OK "APK derlendi! Expo dashboard'dan indirebilirsiniz."
        Write-Host "  https://expo.dev/accounts/$(npx expo whoami 2>&1)/projects/bist-gozcu/builds"
    }
} else {
    Write-Warn "APK derleme atlandı."
}

# ── Tamamlandı! ──────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  ✓ BIST GÖZCÜ kurulumu tamamlandı!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "  📁 Proje:   $ProjectDir" -ForegroundColor White
Write-Host "  🚀 Başlat:  npm start" -ForegroundColor White
Write-Host "  📱 APK:     eas build --platform android --profile preview" -ForegroundColor White
Write-Host "  🔧 VS Code:  kod ." -ForegroundColor White
Write-Host ""
Write-Host "  GitHub Actions CI/CD otomatik çalışacak:" -ForegroundColor White
Write-Host "  • Push → typecheck + lint" -ForegroundColor White
Write-Host "  • main branch → Preview APK" -ForegroundColor White
Write-Host "  • v* tag → Production AAB" -ForegroundColor White
Write-Host ""
Write-Host "  GitHub Secrets eklemeyi unutmayın:" -ForegroundColor Yellow
Write-Host "  Repo → Settings → Secrets → Actions" -ForegroundColor Yellow
Write-Host "  • EXPO_TOKEN (https://expo.dev/settings/access-tokens)" -ForegroundColor Yellow
Write-Host ""
