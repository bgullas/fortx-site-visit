# FortX Site Visit PWA

A Progressive Web App for CCTV site surveys. Captures camera locations with photos, generates structured Google Doc reports, and exports PDFs — all from a phone or tablet on site.

---

## Features

- 📸 **Photo capture** per camera: installation point + field of view
- 📁 **Auto folder creation** in Google Drive (per project)
- 📄 **Google Doc report** generated from template
- 📥 **PDF export** — via Google Drive or local download
- 💾 **Auto-save** — all data persists in localStorage across pages
- 📱 **PWA** — installable on Android/iOS, works offline for data entry

---

## Setup Guide

### Step 1: Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project: `FortX Site Visit`
3. Enable these APIs:
   - **Google Drive API**
   - **Google Docs API**
4. Go to **Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorised JavaScript origins: `https://YOUR-USERNAME.github.io`
   - Authorised redirect URIs: `https://YOUR-USERNAME.github.io/fortx-site-visit/`
5. Copy your **Client ID**

### Step 2: Configure the App

Edit `js/drive.js`, line 7:
```js
CLIENT_ID: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
```

### Step 3: Create the Google Doc Template

1. Open the base Drive folder:
   https://drive.google.com/drive/folders/1iXQQolBCGsCA4xrpzaCy70YW53i2FyB1

2. Create a new Google Doc named: `FortX Site Visit Template`

3. Design the template using these **exact placeholders** (they are replaced automatically):

   | Placeholder | Value |
   |---|---|
   | `{{PROJECT}}` | Project name |
   | `{{LOCATION}}` | Site address |
   | `{{DATE}}` | Visit date |
   | `{{TIME}}` | Visit time |
   | `{{PREPARED_BY}}` | Engineer name |
   | `{{TOTAL_CAMERAS}}` | Number of cameras |
   | `{{VISIT_NOTES}}` | General notes |
   | `{{CAM1_NUMBER}}` | Camera 1 ID |
   | `{{CAM1_DESC}}` | Camera 1 description |
   | `{{CAM2_NUMBER}}` | Camera 2 ID |
   | `{{CAM2_DESC}}` | Camera 2 description |
   | *(up to CAM20)* | |

4. After creating, get the **Template Doc ID** from its URL:
   `https://docs.google.com/document/d/DOC_ID_HERE/edit`

5. Edit `js/report.js`, line 6:
   ```js
   TEMPLATE_ID: 'YOUR_TEMPLATE_DOC_ID',
   ```

### Step 4: Add FortX Logo

Replace `icons/fortx-logo.png` with the actual FortX logo file.
Also generate icon sizes:
- `icons/icon-192.png` (192×192px)
- `icons/icon-512.png` (512×512px)

### Step 5: Deploy to GitHub Pages

1. Create a GitHub repo: `fortx-site-visit`
2. Push this folder to the `main` branch
3. Go to **Settings → Pages → Source: GitHub Actions**
4. The workflow deploys automatically on push

**App URL:** `https://YOUR-USERNAME.github.io/fortx-site-visit/`

---

## Usage Flow

```
① Project Info  →  ② Camera Locations  →  ③ Preview  →  ④ Export
```

- All data auto-saves between tabs
- Camera modal: enter ID, description, install photo, view photo
- Export creates: Drive folder → Google Doc → PDF

---

## File Structure

```
fortx-site-visit/
├── index.html          # Main PWA shell + all UI
├── manifest.json       # PWA manifest
├── sw.js               # Service worker (offline)
├── css/
│   └── app.css         # FortX design system
├── js/
│   ├── app.js          # App state, navigation, auto-save
│   ├── camera.js       # Photo capture utilities
│   ├── drive.js        # Google Drive/Docs API
│   └── report.js       # Report generation + PDF
├── icons/
│   ├── fortx-logo.png  # ← Replace with real logo
│   ├── icon-192.png    # PWA icon
│   └── icon-512.png    # PWA icon
└── .github/
    └── workflows/
        └── deploy.yml  # Auto-deploy to GitHub Pages
```

---

## Google Docs Template Design Tips

- Add the FortX logo in the header (Insert → Image)
- Use a table for project info with `{{PLACEHOLDER}}` cells
- Add a repeating section per camera (or create fixed sections for CAM1–CAM20)
- Style with FortX colors: navy `#0a0f1e`, amber `#f59e0b`

---

## Offline Mode

Without Google Sign-in, the app works fully for data entry and **local PDF download** via jsPDF. The Google Drive integration requires sign-in.
