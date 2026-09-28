# Third-party notices

Pocket Deck is MIT-licensed; see `LICENSE`. Upstream components retain their own licenses. License texts are preserved in `license-notices/`, vendored metadata and the packaged runtime.

| Component | Purpose | License location |
| --- | --- | --- |
| Python 3.13 | Backend runtime | `license-notices/Python-LICENSE.txt` (PSF and included notices) |
| Pillow 12.2.0 | Image processing | `license-notices/Pillow-LICENSE.txt` (including binary dependency notices) |
| qrcode 8.2 | QR generation | `license-notices/qrcode-LICENSE.txt`, `app/vendor/qrcode-8.2.dist-info/LICENSE` (BSD-3-Clause and inherited notices) |
| PyInstaller 6.19.0 | Bootloader/build | `license-notices/PyInstaller-COPYING.txt` (GPL with distribution exception) |
| Electron 44.4.5 | Desktop runtime | Electron `LICENSE` and `LICENSES.chromium.html` included in the runtime |
| electron-builder 26.15.3 / NSIS | Installer build | Upstream npm and installer component licenses |

There are no added runtime npm dependencies beyond Electron. Development dependencies are locked by `app/desktop/package-lock.json` and retain their upstream licenses. Windows packages include Pocket Deck's license and the `license-notices/` directory under `resources/`, plus Electron's runtime notices. Refresh licenses when dependencies change.
