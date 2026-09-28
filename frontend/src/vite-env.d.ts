/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base do backend (ex. `http://localhost:7400`). Vazia → relativa à origem da página. */
  readonly VITE_API_URL?: string;
}

/** Versão do package.json, injetada pelo `define` do vite.config.ts. */
declare const __APP_VERSION__: string;

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
