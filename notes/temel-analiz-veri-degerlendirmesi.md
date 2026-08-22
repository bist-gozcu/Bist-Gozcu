# Temel analiz ve göreli değerleme veri değerlendirmesi

Tarih: 22 Ağustos 2026

## Mevcut uygulama teşhisi

- Mobil servis `fetchStockOverview` çağrısını `https://bist-gozcu--careki73.replit.app/api/bist/stock/:symbol/overview` rotasına yapıyor.
- 22.08.2026 tarihinde THYAO için bu rota HTTP 404 `Cannot GET /api/bist/stock/THYAO/overview` döndürdü. Bu nedenle temel oran ve hisseye özel haber kartı mobilde boş kalıyor.
- API sunucusu kaynak kodunda overview rotası mevcut; sorun büyük olasılıkla bu son sürümün Replit’e deploy edilmemiş olmasıdır.
- API route’unda Yahoo `quoteSummary` modülleri `price`, `summaryDetail`, `defaultKeyStatistics`, `financialData` olarak isteniyor. Yahoo’nun doğrudan `quoteSummary` endpointi için 22.08.2026 testinde HTTP 429 `Too Many Requests` döndü; bu kaynak tek başına güvenilir temel veri katmanı olarak kabul edilmemeli.

## Investing.com araştırması

- Investing.com’un THYAO oranlar sayfasında P/E, P/S, P/B, kârlılık, ROE/ROI, büyüme, borçluluk, temettü ve benzeri oranlar gösteriliyor.
- Aynı sayfa şirket değerlerini sektör ortalamasıyla yan yana gösteriyor. Bu, göreli değerlendirme için teknik olarak istenen veri türüdür.
- Sayfa verinin gecikmeli/indicative olabileceğine dair risk açıklamaları içeriyor.
- Investing.com destek sayfası doğrudan public API sunmadığını açıkça belirtiyor.
- Investing.com kullanım koşulları, otomatik sistemlerle siteden veri çıkarılmasını ve verinin izinsiz kopyalanıp yeniden yayınlanmasını yasaklıyor.

## Güvenli karar

Investing.com’u scraping ile mobil uygulamanın veri kaynağı yapmayacağız. InvestingPro’daki fair value veya sektör ortalamalarını lisans/izin olmadan API gibi kullanmak uygun değil.

İki güvenli yol var:

1. KAP/Borsa İstanbul finansal tablolarından temel oranları kendimiz hesaplamak. Bankalarda P/B, ROE, sermaye yeterliliği ve net faiz marjı; sanayi/holdinglerde P/E, P/B, net borç/FAVÖK, kâr marjı ve büyüme gibi sektör uyumlu oranlar kullanılmalı. Bu daha fazla geliştirme ve rapor dönemlerinde veri güncellemesi gerektirir.
2. Lisanslı bir veri sağlayıcıdan API/izin almak. Fintables veya başka bir sağlayıcı ancak kullanıcının geçerli lisansı ve paylaşım/yeniden yayın hakkı varsa kullanılmalı.

Göreli değerlendirme tek bir “ucuz/pahalı” etiketi olmamalı. Aynı sektör içindeki benzer hisselerle karşılaştırma, şirketin kendi geçmiş oranları ve temel kalite/risk filtresi birlikte kullanılmalı. Veri tarihi ve finansal dönem kartta gösterilmeli; eksik veri varsa oran uydurulmamalı.

## Uygulama önerisi

Önce overview API rotasını gerçekten deploy edip mobil kartın veri almasını sağlayacağız. Ardından Yahoo’dan gelen alanları yalnızca doğrulanabildiği ölçüde göstereceğiz. Kapsamlı temel/göreli analiz için sonraki aşamada KAP temelli ve sektör ayrımlı veri modeli tasarlanacak. Kullanıcı onayı olmadan kod, Replit deploy’u veya OTA yapılmayacak.

Kaynaklar:

- Investing.com THYAO Ratios: https://www.investing.com/equities/turk-hava-yollari-ratios
- Investing.com API erişimi açıklaması: https://www.investing-support.com/hc/en-us/articles/115005473825-Do-You-Offer-API-Access-at-Investing-com
- Investing.com Terms and Conditions: https://cdn.investing.com/about-us/terms_and_conditions.pdf
- Borsa İstanbul BIST 30: https://www.borsaistanbul.com/en/index/xu030
- Borsa İstanbul BIST 50: https://www.borsaistanbul.com/en/index/xu050

## TradingView araştırması — 22 Ağustos 2026

- TradingView’ın BIST:BESTE finansal istatistikler sayfası BIST sembolleri için Statistics bölümünde değerleme oranları (P/E, P/S, P/CF, P/FCF, P/B, EV, EV/EBITDA), kârlılık oranları, likidite, borçluluk, hisse başı veriler, nakit akışı ve temettü verileri gösteriyor. Yıllık, çeyreklik ve mevcut dönem sütunları bulunuyor.
- TradingView resmi yardım sayfası Financials bölümünde gelir tablosu, bilanço, nakit akışı ve Statistics sekmelerinin kullanılabildiğini; Statistics sekmesinde P/E, P/S ve P/B gibi oranlarla şirket karşılaştırmasının yapılabildiğini belirtiyor.
- Aynı TradingView yardım sayfası, Supercharts finansal verilerinin şirket raporlarındaki verilerden farklı olabileceği konusunda uyarıyor. Bu nedenle TradingView verisi uygulamada kaynak ve dönem etiketiyle gösterilmeli, tek başına kesin değerleme hükmü olarak kullanılmamalı.
- TradingView sayfalarında veri görünür olsa da bu, BIST Gözcü’nün veriyi otomatik olarak scrape edip yeniden yayınlayabileceği anlamına gelmez. Entegrasyon için TradingView’ın lisans/API koşulları ayrıca doğrulanmalı; izin yoksa sayfa kazıma yapılmamalı.

Karar: TradingView, Investing.com gibi temel ve göreli değerleme ekranı olarak veri kapsamına sahip görünüyor. Ancak uygulamaya backend veri kaynağı olarak bağlamak için resmî API veya lisans gerekir. Lisans yoksa güvenli seçenek KAP/Borsa İstanbul finansallarını kullanarak oranları uygulama sunucusunda hesaplamak veya lisanslı bir veri sağlayıcı kullanmaktır.

Kaynaklar:

- TradingView BIST:BESTE Statistics: https://www.tradingview.com/symbols/BIST-BESTE/financials-statistics-and-ratios/
- TradingView Help Center — How to access financial data: https://www.tradingview.com/support/solutions/43000543506-how-to-access-financial-data-on-tradingview/
- TradingView BIST 50 components: https://www.tradingview.com/symbols/BIST-XU050/components/

## TradingView API ve kullanım koşulları

- TradingView’ın resmî destek sayfası, ham piyasa verisi veya gösterge değerleri için genel kullanıma açık bir API sunmadığını belirtiyor. TradingView REST API’si broker entegrasyonları içindir.
- TradingView Charting Library dokümantasyonu, grafik kütüphanesinin bir veri kaynağını kendisi sağlamadığını; geliştiricinin kendi backend datafeed’ini bağlaması gerektiğini açıklıyor.
- TradingView Terms of Use sayfası, market data kullanımını kişisel kullanım ile sınırlandıran ve otomatik işlem, algoritmik karar verme ve display dışı makine süreçleri için TradingView market data kullanımını kısıtlayan maddeler içeriyor.

Sonuç: TradingView’da temel analiz verisi var; ancak BIST Gözcü’nün arka planında TradingView web sayfasını scrape ederek veya kullanıcı aboneliği üzerinden otomatik veri çekerek kullanmak uygun değil. TradingView ancak kullanıcıyı ilgili sayfaya yönlendiren harici bağlantı olarak kullanılabilir veya resmî lisans/kurumsal erişim alınırsa entegrasyon kaynağı olabilir.

Kaynaklar:

- TradingView API erişimi: https://www.tradingview.com/support/solutions/43000474413-i-need-access-to-your-api-in-order-to-get-data-or-indicator-values/
- TradingView Terms of Use: https://www.tradingview.com/policies/
- TradingView Charting Library API/Datafeed: https://www.tradingview.com/charting-library-docs/latest/api/
