---
title: ატვირთვის API
description: Fenfa-ს HTTP API აშენებების ატვირთვისთვის, პროდუქტების მართვისთვის და დისტრიბუციის მეტამონაცემების მოძიებისთვის.
sidebar:
  order: 2
---

Fenfa აქვეყნებს HTTP API-ს CI/CD პაიპლაინებიდან აშენების არტეფაქტების ატვირთვისა და დისტრიბუციის სასიცოცხლო ციკლის მართვისთვის.

## ავტორიზაცია

ყველა API მოთხოვნა საჭიროებს ტოკენს `X-Auth-Token` ჰედერში:

```
X-Auth-Token: your-api-token
```

ტოკენები იქმნება Fenfa-ს ადმინის დაფაში პარამეტრების განყოფილებაში.

## ატვირთვის ბოლო წერტილი

### POST /upload

აშენების არტეფაქტის ატვირთვა კონკრეტულ ვარიანტზე.

**Content-Type:** `multipart/form-data`

| ველი | ტიპი | სავალდებულო | აღწერა |
|-------|------|----------|-------------|
| `variant_id` | string | დიახ | სამიზნე ვარიანტის ID |
| `app_file` | file | დიახ | ბინარული არტეფაქტი (IPA, APK, DMG, EXE და ა.შ.) |
| `version` | string | დიახ | სემანტიკური ვერსია (მაგ., `2.1.5`) |
| `build` | string | დიახ | აშენების ნომერი (მაგ., `142`) |
| `changelog` | string | არა | რელიზის შენიშვნები (Markdown მხარდაჭერილი) |

Fenfa ავტომატურად ითვლის ატვირთული ფაილის **SHA-256 ჰეშს** მთლიანობის ვერიფიკაციისთვის.

**მაგალითი:**

```bash
curl -X POST https://fenfa.example.com/upload \
  -H "X-Auth-Token: your-api-token" \
  -F "variant_id=abc123" \
  -F "app_file=@build/MyApp.ipa" \
  -F "version=2.1.5" \
  -F "build=142" \
  -F "changelog=Fixed login crash on iOS 18"
```

**პასუხი:**

```json
{
  "success": true,
  "release": {
    "id": "rel_abc123",
    "version": "2.1.5",
    "build": "142",
    "sha256": "e3b0c44298fc1c149afbf4c8996fb924...",
    "download_url": "https://fenfa.example.com/d/rel_abc123",
    "install_url": "itms-services://?action=download-manifest&url=...",
    "qr_code_url": "https://fenfa.example.com/qr/rel_abc123"
  }
}
```

პასუხი მოიცავს პლატფორმისთვის შესაფერის URL-ებს:

- `download_url` -- პირდაპირი ჩამოტვირთვის ბმული (ყველა პლატფორმა)
- `install_url` -- iOS OTA ინსტალაციის ბმული (მხოლოდ IPA)
- `qr_code_url` -- QR კოდის სურათი ჩამოტვირთვის გვერდისთვის

## აპლიკაციის მეტამონაცემების ანალიზი

### POST /admin/api/parse-app

ბინარის ატვირთვა მისი მეტამონაცემების ამოსაღებად რელიზის შექმნის გარეშე. სასარგებლოა აშენების არტეფაქტების ინსპექტირებისთვის.

```bash
curl -X POST https://fenfa.example.com/admin/api/parse-app \
  -H "X-Auth-Token: your-api-token" \
  -F "file=@build/MyApp.apk"
```

აბრუნებს ამოცნობილ მეტამონაცემებს, როგორიცაა bundle ID, ვერსია, მინიმალური OS ვერსია, ნებართვები და ხატულა.

## ადმინის API

ადმინის API უზრუნველყოფს დისტრიბუციის პლატფორმის სრულ მართვას.

### პროდუქტები

| მეთოდი | ბოლო წერტილი | აღწერა |
|--------|----------|-------------|
| GET | `/admin/api/products` | ყველა პროდუქტის ჩამოთვლა |
| POST | `/admin/api/products` | პროდუქტის შექმნა |
| GET | `/admin/api/products/:id` | პროდუქტის დეტალების მიღება |
| PUT | `/admin/api/products/:id` | პროდუქტის განახლება |
| DELETE | `/admin/api/products/:id` | პროდუქტის წაშლა |

### ვარიანტები

| მეთოდი | ბოლო წერტილი | აღწერა |
|--------|----------|-------------|
| GET | `/admin/api/products/:id/variants` | პროდუქტის ვარიანტების ჩამოთვლა |
| POST | `/admin/api/variants` | ვარიანტის შექმნა |
| PUT | `/admin/api/variants/:id` | ვარიანტის განახლება |
| DELETE | `/admin/api/variants/:id` | ვარიანტის წაშლა |

### რელიზები

| მეთოდი | ბოლო წერტილი | აღწერა |
|--------|----------|-------------|
| GET | `/admin/api/variants/:id/releases` | ვარიანტის რელიზების ჩამოთვლა |
| GET | `/admin/api/releases/:id` | რელიზის დეტალების მიღება |
| DELETE | `/admin/api/releases/:id` | რელიზის წაშლა |

### პარამეტრები

| მეთოდი | ბოლო წერტილი | აღწერა |
|--------|----------|-------------|
| GET | `/admin/api/settings` | პლატფორმის პარამეტრების მიღება |
| PUT | `/admin/api/settings` | პლატფორმის პარამეტრების განახლება |

### მოწყობილობები

| მეთოდი | ბოლო წერტილი | აღწერა |
|--------|----------|-------------|
| GET | `/admin/api/devices` | ჩარიცხული iOS მოწყობილობების (UDID) ჩამოთვლა |
| DELETE | `/admin/api/devices/:id` | მოწყობილობის ამოშლა |

### მოვლენები

| მეთოდი | ბოლო წერტილი | აღწერა |
|--------|----------|-------------|
| GET | `/admin/api/events` | მოვლენების ჟურნალი (ატვირთვები, ჩამოტვირთვები, შეცდომები) |

მოვლენების ბოლო წერტილი მხარს უჭერს გვერდებს და ფილტრაციას მოვლენის ტიპის, თარიღის დიაპაზონისა და ვარიანტის მიხედვით.

## CSV ექსპორტი

ადმინის API მხარს უჭერს CSV ექსპორტს მასობრივი მონაცემების ამოსაღებად:

```bash
# ვარიანტის ყველა რელიზის ექსპორტი
curl -H "X-Auth-Token: your-api-token" \
  "https://fenfa.example.com/admin/api/variants/abc123/releases?format=csv" \
  -o releases.csv

# მოწყობილობების სიის ექსპორტი
curl -H "X-Auth-Token: your-api-token" \
  "https://fenfa.example.com/admin/api/devices?format=csv" \
  -o devices.csv
```

## CI/CD ინტეგრაციის მაგალითი

### GitHub Actions

```yaml
- name: Upload to Fenfa
  run: |
    curl -X POST ${{ secrets.FENFA_URL }}/upload \
      -H "X-Auth-Token: ${{ secrets.FENFA_TOKEN }}" \
      -F "variant_id=${{ vars.FENFA_VARIANT_ID }}" \
      -F "app_file=@build/output/MyApp.apk" \
      -F "version=${{ github.ref_name }}" \
      -F "build=${{ github.run_number }}" \
      -F "changelog=$(git log --oneline -5)"
```
