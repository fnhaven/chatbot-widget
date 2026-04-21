# Chatbot Web Widget

Embeddable chatbot widget berbasis Vanilla JS dengan Shadow DOM. Bisa di-embed ke website apa saja via script tag.

## Build

```bash
npm install
npm run build
```

Output: `dist/widget.min.js` (minified, inline CSS + JS)

## Cara Embed

Tambahkan script tag ke HTML website:

```html
<script src="https://cdn-anda.com/widget.min.js"></script>
<script>
  window.ChatbotWidget.init({
    apiBase: 'https://api-anda.com/api',
    position: 'bottom-right',
    primaryColor: '#2563eb',
    title: 'AI Assistant',
    subtitle: 'Tanya kami apa saja',
    placeholder: 'Ketik pertanyaan Anda...',
  });
</script>
```

## Config Options

| Option | Type | Default | Deskripsi |
|--------|------|---------|-----------|
| `apiBase` | `string` | `http://localhost:3000/api` | Base URL API |
| `position` | `string` | `bottom-right` | Posisi widget (`bottom-right`, `bottom-left`) |
| `offsetX` | `number` | `24` | Offset horizontal (px) |
| `offsetY` | `number` | `24` | Offset vertical (px) |
| `primaryColor` | `string` | `#2563eb` | Warna utama |
| `zIndex` | `number` | `999999` | z-index widget |
| `title` | `string` | `AI Assistant` | Judul header |
| `subtitle` | `string` | `Tanya kami apa saja` | Subtitle header |
| `placeholder` | `string` | `Ketik pertanyaan Anda...` | Placeholder input |
| `welcomeMessage` | `string` | `Halo! Ada yang bisa kami bantu?...` | Pesan sambutan |

## Fitur

- **Shadow DOM**: CSS ter-isolasi, tidak bentrok dengan host page
- **Socket.IO**: Real-time notifikasi ticket update & CS chat
- **Responsive**: Support mobile & desktop
- **Auto Session**: Session ID disimpan di `localStorage`
- **Feedback**: Tombol 👍 / 👎 setiap jawaban
- **Ticketing Flow**: Buat tiket keluhan langsung dari chat
- **CS Handover**: Alihkan ke Customer Service via Socket.IO

## CI/CD

Repo ini punya GitHub Actions workflow (`.github/workflows/build-widget.yml`) yang auto-build `dist/widget.min.js` setiap kali ada push ke `main` dengan perubahan di `src/`.

## Struktur File

```
web-widget/
├── src/
│   ├── widget.js    # Core logic
│   └── styles.css   # Widget styles (injected ke Shadow DOM)
├── dist/
│   └── widget.min.js # Build output (CSS inline + JS minified)
├── build.js         # Bundler script (Terser)
└── package.json
```
