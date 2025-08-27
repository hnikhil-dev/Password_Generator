# 🔐 Password Generator — Secure & Memorable

![Release](https://img.shields.io/badge/release-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Client-only](https://img.shields.io/badge/client--side-100%25-orange)
![Status](https://img.shields.io/badge/status-stable-success)

> A **modern, audited, and client-only** password generator that produces both  
> **memorable passphrases** and **cryptographically secure random character passwords**.  
> Includes **entropy calculation** and **crack-time estimates** before and after generation.  
> No servers. No data leaks. No storage. **100% local.**

---

## 🚀 Demo (Quick Preview)

![demo](assets/demo.gif)

> If the demo does not appear on GitHub, ensure `assets/demo.gif` exists and is committed.  

---

## 📂 Features at a Glance

- **Two Modes** → Passphrase (memorable) & Character (random chars)  
- **Secure RNG** → Uses `crypto.getRandomValues()` for all randomness  
- **Strength Metrics** → Bits of entropy & crack-time estimation (configurable guesses/sec)  
- **Client-only** → Runs entirely in-browser, nothing sent anywhere  
- **CSP-ready** → Example Content-Security-Policy meta included for audit-friendly hosting  
- **Accessibility-first** → ARIA live regions & full keyboard navigation  
- **Responsive UI** → Works on desktop & mobile  

---

## 🔍 Project Structure

```bash
├── assets/        # Screenshots & demo GIF
├── index.html     # Main UI + CSP meta
├── style.css      # Responsive styling
├── script.js      # Core logic: RNG, entropy, generators
├── README.md      # Documentation (this file)
└── LICENSE        # MIT license
```
--- 

## 🔍 Why This Project?

- Memorability + Security → Passphrase mode uses curated wordlists + randomized transforms (case, leet, digits, symbols). Easy to memorize, hard to crack.
- Transparent Math → Entropy calculated from combinatorics & transforms. Results shown as both bits and realistic crack-time.
- Minimal Attack Surface → Pure static client app, CSP protection, zero external libraries.

---

## 🛠 Usage — Local Setup (30s)

> Run locally for the best experience (clipboard API works best on HTTPS or localhost).
```
# Start a local static server (Python)
python -m http.server 8000
# Then open in browser:
http://localhost:8000
```

---

## 📌 Requirements

> Modern browsers only:

- Chrome ≥ 90
- Firefox ≥ 88
- Edge ≥ 90
- Safari ≥ 14

⚡**Note**: Clipboard features may be restricted on file://. Always use localhost or HTTPS.

---

## 📜 License

This project is licensed under the MIT License.
You’re free to use, modify, and distribute with attribution.

---

## 🌐 Connect with Me

I’d love feedback, suggestions, and contributions!

[![Twitter](https://img.shields.io/badge/X.com-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/NikhilDabhade17) 
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/nikhil-dabhade-602a86286/)