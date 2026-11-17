# PDF & Image Converter

This entry page now redirects to `/creations/converter/`. The consolidated tool
is maintained in `../converter/`; its PDF engine reuses this folder's vendor assets.

Static browser tool at `/creations/pdf-image-converter/`. No build or API required.
PDF.js renders selected pages; pdf-lib builds one PDF from ordered images; fflate
packages image downloads. All libraries, fonts, character maps, and decoders are
served locally. File contents are never sent to a server.

Vendored dependencies (unmodified, with licenses):

- Mozilla PDF.js / pdfjs-dist 5.4.624, Apache-2.0 (`vendor/pdfjs/`).
- pdf-lib 1.17.1, MIT (`vendor/pdf-lib.min.js`).
- fflate 0.8.3, MIT (`vendor/fflate.js`).

Serve the repository root over HTTP; browser modules and workers do not work from
`file://`. Use a current browser. Limits: 150 MB input total, 100 pages/images per
export, 16 million rendered pixels per page/image. Lower the resolution or select
fewer pages for large PDFs. PNG transparency is retained when embedding images;
PDF exports use a white page background. Images are decoded through the browser
to apply camera orientation. JPEG images are re-encoded at 98% quality. No OCR.

Checks: `node --test scripts/converters.test.mjs scripts/site-routes.test.mjs`.
