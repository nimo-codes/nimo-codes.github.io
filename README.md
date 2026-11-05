# naman.ai: personal portfolio

Static site (HTML/CSS/JS + Three.js). No build step, so it runs on GitHub Pages for free.

## Preview locally
```bash
cd website
python3 -m http.server 8000
# open http://localhost:8000
```

## Add your photo
Save a square photo as `assets/profile.jpg`. Until then, the site shows an "NN" monogram.

## Deploy to GitHub Pages
1. Create a new **public** repo named `nimo-codes.github.io` on GitHub.
2. Push this folder:
   ```bash
   git init
   git add .
   git commit -m "Launch portfolio"
   git branch -M main
   git remote add origin https://github.com/nimo-codes/nimo-codes.github.io.git
   git push -u origin main
   ```
3. On GitHub: **Settings → Pages → Source: Deploy from a branch → `main` / `(root)`** → Save.
4. In about a minute it's live at **https://nimo-codes.github.io**.

## Editing content
- Page text, experience and projects: `index.html`
- Chat answers (naman-7b): the `KB` list at the top of `js/chat.js`
- Skills and their "weights": the `skills` object in `js/main.js`
- Colors: the variables at the top of `css/style.css`
- Resume download: replace `assets/NamanNanda_Resume.pdf`
