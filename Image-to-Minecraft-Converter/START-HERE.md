# Open in VS Code

1. Extract the entire ZIP.
2. In VS Code, choose **File → Open Folder** and select **Image-to-Minecraft-Converter**.
3. Install the recommended **Live Server** extension if needed.
4. Open **dist/index.html**, right-click in the editor, and choose **Open with Live Server**.

No API keys, npm install, or build step are needed. All scripts, Korean translations, block textures, and the 3D library are included.

## Alternative: Python

Run in the VS Code terminal from this folder:

Windows:
```sh
py -m http.server 8080 --directory dist
```
macOS / Linux:
```sh
python3 -m http.server 8080 --directory dist
```
Open http://localhost:8080. Press Ctrl+C to stop the server.

Do not double-click index.html: browser modules need a web server.

## Editing

- dist/index.html — layout
- dist/style.css — colors and sizing
- dist/app.js — application behavior
- dist/i18n.js and dist/locales/ko.js — language switching and Korean translations
- dist/blocks.json and dist/textures/ — blocks and textures

Keep the full dist folder together. To host the website, upload the contents of dist.

## Bring saved projects over

In the hosted converter, choose **Export → Project backup**. In your local copy, choose **Projects → Import project backup**. Saved projects do not automatically transfer between website addresses.
