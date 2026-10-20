import { createElement } from "react";
import { createRoot } from "react-dom/client";
import ImageEditor from "../app/components/ImageEditor";

// Opens the photo editor (crop, compress, preview) for a picked or dropped image and
// resolves with the finished File, or null if the person cancelled.
// PDFs and other files are returned untouched. Several calls wait for each other, so
// two dropped photos are edited one after the other. Everything stays in the browser.

const EDITABLE = new Set(["image/jpeg", "image/png", "image/webp"]);
let chain = Promise.resolve();

export function editImageFile(file) {
  if (!file || !EDITABLE.has(file.type) || typeof document === "undefined") return Promise.resolve(file);

  const run = () =>
    new Promise((resolve) => {
      const host = document.createElement("div");
      document.body.appendChild(host);
      const root = createRoot(host);
      const finish = (result) => {
        resolve(result);
        setTimeout(() => {
          root.unmount();
          host.remove();
        }, 0);
      };
      root.render(createElement(ImageEditor, { file, onDone: finish }));
    });

  const p = chain.then(run, run);
  chain = p.catch(() => {});
  return p;
}
