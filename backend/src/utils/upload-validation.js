import { ApiError } from '../middleware/job-application.middleware.js';
import { MAX_UPLOAD_BYTES, uploadNameSchema } from '../schemas/upload.schema.js';

const invalid = () => { throw new ApiError(400, 'INVALID_FILE', 'Nội dung file không đúng định dạng hoặc file bị hỏng.'); };
function validDocx(bytes) {
  // Inspect ZIP metadata only; never execute Office files or inflate unbounded data.
  let end = -1;
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65557); index--) {
    if (bytes.readUInt32LE(index) === 0x06054b50 && index + 22 + bytes.readUInt16LE(index + 20) === bytes.length) { end = index; break; }
  }
  if (end < 0 || bytes.readUInt32LE(0) !== 0x04034b50 || bytes.readUInt32LE(end + 4) !== 0) return false;
  const count = bytes.readUInt16LE(end + 10), size = bytes.readUInt32LE(end + 12), start = bytes.readUInt32LE(end + 16);
  if (!count || count > 4096 || start + size !== end) return false;
  let cursor = start, total = 0; const names = new Set();
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > end || bytes.readUInt32LE(cursor) !== 0x02014b50) return false;
    const flags = bytes.readUInt16LE(cursor + 8), method = bytes.readUInt16LE(cursor + 10), compressed = bytes.readUInt32LE(cursor + 20);
    const length = bytes.readUInt16LE(cursor + 28), extra = bytes.readUInt16LE(cursor + 30), comment = bytes.readUInt16LE(cursor + 32), local = bytes.readUInt32LE(cursor + 42);
    total += bytes.readUInt32LE(cursor + 24);
    if ((flags & 1) || ![0, 8].includes(method) || total > 50 * 1024 * 1024 || cursor + 46 + length + extra + comment > end || local + 30 > start) return false;
    const name = bytes.subarray(cursor + 46, cursor + 46 + length).toString('utf8');
    if (name.includes('..') || name.includes('\\') || name.startsWith('/') || names.has(name) || /vbaproject/i.test(name)) return false;
    if (bytes.readUInt32LE(local) !== 0x04034b50 || local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28) + compressed > start) return false;
    names.add(name); cursor += 46 + length + extra + comment;
  }
  return cursor === end && names.has('[Content_Types].xml') && names.has('word/document.xml');
}
function imageDimensions(bytes, extension) {
  if (extension === 'png') {
    if (bytes.length < 45 || !bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) || bytes.toString('ascii', 12, 16) !== 'IHDR' || bytes.toString('ascii', bytes.length - 8, bytes.length - 4) !== 'IEND') invalid();
    return [bytes.readUInt32BE(16), bytes.readUInt32BE(20), 'image/png'];
  }
  if (['jpg', 'jpeg'].includes(extension)) {
    if (bytes.length < 12 || bytes.readUInt16BE(0) !== 0xffd8 || bytes.readUInt16BE(bytes.length - 2) !== 0xffd9) invalid();
    let offset = 2;
    while (offset + 4 < bytes.length) {
      if (bytes[offset++] !== 255) invalid();
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) invalid();
      const length = bytes.readUInt16BE(offset);
      if (length < 2 || offset + length > bytes.length) invalid();
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        if (length < 8) invalid(); return [bytes.readUInt16BE(offset + 5), bytes.readUInt16BE(offset + 3), 'image/jpeg'];
      }
      offset += length;
    }
    invalid();
  }
  if (extension === 'webp') {
    if (bytes.length < 30 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP' || bytes.readUInt32LE(4) + 8 !== bytes.length) invalid();
    const type = bytes.toString('ascii', 12, 16);
    if (type === 'VP8X') return [bytes.readUIntLE(24, 3) + 1, bytes.readUIntLE(27, 3) + 1, 'image/webp'];
    if (type === 'VP8 ' && bytes.subarray(23, 26).equals(Buffer.from('9d012a', 'hex'))) return [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff, 'image/webp'];
    if (type === 'VP8L' && bytes[20] === 0x2f) { const bits = bytes.readUInt32LE(21); return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1, 'image/webp']; }
    invalid();
  }
  invalid();
}
export function validateUpload(bytes, name, kind) {
  const parsed = uploadNameSchema.safeParse(name);
  if (!parsed.success || !Buffer.isBuffer(bytes) || !bytes.length) throw new ApiError(400, 'INVALID_FILE', 'Chọn file có nội dung và tên hợp lệ.');
  if (bytes.length >= MAX_UPLOAD_BYTES) throw new ApiError(413, 'FILE_TOO_LARGE', 'Kích thước file phải dưới 5 MB.');
  const extension = parsed.data.split('.').at(-1).toLowerCase();
  let contentType;
  if (kind === 'resume') {
    if (!['pdf', 'doc', 'docx'].includes(extension)) throw new ApiError(400, 'UNSUPPORTED_FILE_TYPE', 'CV chỉ hỗ trợ .doc, .docx và .pdf.');
    if (extension === 'pdf') {
      // Readers accept a BOM/preamble and padding after EOF. Parse the actual
      // document in UploadService as well; a signature alone is insufficient.
      const header = bytes.indexOf(Buffer.from('%PDF-'));
      if (header < 0 || header > 1024 || !/^%PDF-(1\.[0-9]|2\.0)/.test(bytes.subarray(header, header + 12).toString('ascii')) || bytes.lastIndexOf(Buffer.from('%%EOF')) <= header) invalid();
      contentType = 'application/pdf';
    } else if (extension === 'doc') {
      if (bytes.length < 512 || !bytes.subarray(0, 8).equals(Buffer.from('d0cf11e0a1b11ae1', 'hex')) || bytes.readUInt16LE(28) !== 0xfffe || ![9, 12].includes(bytes.readUInt16LE(30))) invalid();
      const streamName = Buffer.from('WordDocument\0', 'utf16le'); let validStream = false;
      for (let word = bytes.indexOf(streamName); word >= 0; word = bytes.indexOf(streamName, word + 2)) {
        if (word % 128 === 0 && word + 128 <= bytes.length && bytes.readUInt16LE(word + 64) === 26 && bytes[word + 66] === 2) { validStream = true; break; }
      }
      if (!validStream) invalid();
      contentType = 'application/msword';
    } else { if (bytes.length < 22 || !validDocx(bytes)) invalid(); contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'; }
  } else {
    if (!['jpg', 'jpeg', 'png', 'webp'].includes(extension)) throw new ApiError(400, 'UNSUPPORTED_FILE_TYPE', 'Ảnh chỉ hỗ trợ JPG, PNG và WEBP.');
    const [width, height, mime] = imageDimensions(bytes, extension);
    if (!width || !height || width > 8192 || height > 8192 || width * height > 40000000) throw new ApiError(400, 'INVALID_IMAGE_SIZE', 'Ảnh quá lớn. Chọn ảnh tối đa 8192 px mỗi chiều và 40 megapixel.');
    contentType = mime;
  }
  return { file_name: parsed.data, content_type: contentType, size: bytes.length };
}
