# Deploy On Render (Node + Express)

## 1) Prerequisites

- A GitHub repository containing this project
- A Render account

## 2) Push code to GitHub

```bash
git add .
git commit -m "Prepare app for Render deployment"
git push origin main
```

## 3) Deploy on Render

### Option A: Blueprint (recommended)

1. In Render Dashboard, click `New +` -> `Blueprint`.
2. Connect your GitHub repository.
3. Render reads `render.yaml` automatically.
4. Click `Apply` and wait for deployment to finish.

### Option B: Manual Web Service

1. In Render Dashboard, click `New +` -> `Web Service`.
2. Connect your GitHub repository.
3. Set:
   - `Environment`: `Node`
   - `Build Command`: `npm install`
   - `Start Command`: `npm start`
4. Click `Create Web Service`.

## 4) Verify deployment

After deploy, open:

`https://<your-render-service>.onrender.com/api/health`

Expected response:

```json
{"ok":true}
```

## 5) Test form submission

1. Open your Render app URL.
2. Fill the form and submit.
3. Data will be written to `data/employee_data.xlsx` on the server.

## 6) Important note for free plan

Render free services use ephemeral filesystem. That means Excel files may reset on restart/redeploy.

For persistent Excel storage, use:
- Render paid disk
- or external storage (Google Sheets, database, S3, etc.)
