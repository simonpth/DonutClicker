# Donut Clicker 🍩

Ein kleines 3D-Klickspiel: Klick auf den Donut, kaufe Gebäude und werde zum Donut-Imperium. Läuft komplett im Browser, ohne Build-Schritt.

## Lokal ausprobieren

ES-Module brauchen einen Webserver (direktes Öffnen der `index.html` funktioniert nicht). Im Projektordner z. B.:

```bash
python3 -m http.server 8000
```

Dann im Browser `http://localhost:8000` öffnen.

## Auf GitHub Pages deployen

1. Repository auf GitHub anlegen und alle Dateien hochladen (inklusive der leeren Datei `.nojekyll`).
2. Im Repo unter **Settings → Pages** als Source **Deploy from a branch** wählen, Branch `main`, Ordner `/ (root)`.
3. Nach ein paar Minuten ist das Spiel erreichbar unter `https://<benutzername>.github.io/<repository>/`.

Alle Pfade im Projekt sind relativ, daher funktioniert das Spiel auch in einem Unterpfad. Die Datei `.nojekyll` sorgt dafür, dass GitHub Pages die Dateien unverändert ausliefert.

## Abhängigkeiten

- [Three.js](https://threejs.org/) (MIT-Lizenz), geladen über das jsDelivr-CDN.

## Lizenz

MIT, siehe [LICENSE](LICENSE).
