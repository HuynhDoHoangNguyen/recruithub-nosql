export function apiErrorMessage(error) {
  if (!error.response) return 'Không kết nối được máy chủ API. Kiểm tra Backend đang chạy và thử lại.';
  if (error.response.status >= 500 && typeof error.response.data !== 'object') {
    return 'Máy chủ API chưa phản hồi đúng. Kiểm tra Backend đang chạy và thử lại.';
  }
  if (error.response.data?.error?.code === 'NOT_FOUND' && /\/auth\//.test(error.config?.url || '')) {
    return 'Dịch vụ tài khoản chưa được tích hợp. Hiện chưa thể đăng nhập hoặc đăng ký.';
  }
  return error.response.data?.error?.message || error.response.data?.message || 'Không thể xử lý yêu cầu. Vui lòng thử lại.';
}
