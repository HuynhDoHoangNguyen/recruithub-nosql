export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export function fileValidation(file, kind) {
  if (!file?.size) return 'File không được để trống.';
  if (file.size >= MAX_FILE_BYTES) return 'Kích thước file phải dưới 5 MB.';
  const extension = file.name.split('.').at(-1).toLowerCase();
  if (!(kind === 'resume' ? ['doc', 'docx', 'pdf'] : ['jpg', 'jpeg', 'png', 'webp']).includes(extension)) return kind === 'resume' ? 'CV chỉ hỗ trợ .doc, .docx và .pdf.' : 'Ảnh chỉ hỗ trợ JPG, PNG và WEBP.';
  return '';
}
