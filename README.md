# Next Performance Extension

Bu proje, Next.js sayfalari icin performans analizi yapan Manifest V3 tabanli bir Chrome extension'dir.

## Komutlar

- `npm install`
- `npm run build`
- `npm run dev`

## Klasor yapisi

- `src/background`: service worker mantigi
- `src/content`: content script dosyalari
- `src/popup`: popup arayuzu
- `src/options`: options sayfasi
- `src/shared`: ortak yardimci moduller

## Chrome'a yukleme

1. `npm run build`
2. Chrome'da `chrome://extensions` sayfasini ac
3. `Developer mode` aktif et
4. `Load unpacked` ile `dist` klasorunu sec

## Release Checklist

- `npm run build`
- `dist/manifest.json` icinde ikonlarin ve aciklamanin dogru oldugunu kontrol et
- Popup, badge ve dashboard ekranlarini manuel test et
- `Options` ekraninda export ve grafiklerin calistigini kontrol et
- Chrome Web Store icin ekran goruntuleri hazirla

## Chrome Web Store Yukleme

1. `npm run build`
2. `dist` klasorundeki ciktidan bir zip paket olustur
3. Chrome Web Store Developer Dashboard'a gir
4. Yeni bir item olusturup zip dosyasini yukle
5. Store listing alanlarini doldur:
   - kisa aciklama
   - detayli aciklama
   - ikon
   - ekran goruntuleri
   - kategori
   - gizlilik/aciklama metinleri
6. Inceleme icin gonder
# next_performance-_extension
