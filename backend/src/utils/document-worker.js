import { parentPort, workerData } from 'node:worker_threads';
import { PDFDocument } from 'pdf-lib';
import WordExtractor from 'word-extractor';

try {
  const bytes = Buffer.from(workerData.bytes);
  if (workerData.action === 'validate-pdf') {
    // Keep the original bytes, including encryption/signatures. Native browser
    // viewers handle password prompts; this does not decrypt or rewrite files.
    const pdf = await PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true });
    if (!pdf.getPageCount()) throw new Error('No pages');
    parentPort.postMessage({ ok: true });
  } else {
    const document = await new WordExtractor().extract(bytes);
    const text = document.getBody();
    parentPort.postMessage({ ok: true, text: text.slice(0, 500000), truncated: text.length > 500000 });
  }
} catch {
  parentPort.postMessage({ ok: false });
}
