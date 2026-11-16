export const topics = [
  {
    id: 'jobs', question: 'Tìm việc như thế nào?', title: 'Tìm vị trí phù hợp',
    steps: ['Mở trang Việc làm, nhập từ khóa hoặc kỹ năng bạn quan tâm.', 'Lọc theo địa điểm, hình thức làm việc và các tiêu chí phù hợp.', 'Mở chi tiết tin để xem yêu cầu, hạn nộp và trạng thái nhận hồ sơ.'],
    to: '/jobs', action: 'Khám phá việc làm',
  },
  {
    id: 'profile', question: 'Cập nhật hồ sơ ở đâu?', title: 'Chuẩn bị hồ sơ ứng viên',
    steps: ['Đăng nhập bằng tài khoản ứng viên và mở Hồ sơ cá nhân.', 'Chọn Chỉnh sửa hồ sơ, cập nhật thông tin liên hệ, kỹ năng, kinh nghiệm, học vấn và dự án.', 'Kiểm tra thông tin, cập nhật CV nếu cần rồi lưu thay đổi.'],
    to: '/profile', action: 'Mở hồ sơ cá nhân', protected: true,
  },
  {
    id: 'apply', question: 'Làm sao để ứng tuyển?', title: 'Gửi hồ sơ cho nhà tuyển dụng',
    steps: ['Đăng nhập bằng tài khoản ứng viên, tìm và mở một tin còn nhận hồ sơ.', 'Chọn Nộp hồ sơ ứng tuyển. Tải CV từ máy, dùng CV từ hồ sơ hoặc nhập CV văn bản.', 'Kiểm tra nội dung và xác nhận gửi. Sau khi thành công, mở Đơn ứng tuyển để theo dõi.'],
    note: 'Tin tham khảo, tin đã đóng hoặc hết hạn không nhận hồ sơ mới.',
    to: '/jobs', action: 'Tìm việc để ứng tuyển',
  },
  {
    id: 'tracking', question: 'Xem tiến trình ứng tuyển ở đâu?', title: 'Theo dõi đơn đã nộp',
    steps: ['Đăng nhập bằng tài khoản ứng viên và mở trang Đơn ứng tuyển.', 'Chọn Xem chi tiết, CV và lịch sử để xem tiến trình và hồ sơ đã gửi.', 'Nếu cần rút đơn, dùng nút Rút đơn và xác nhận. Lịch sử vẫn được giữ lại.'],
    note: 'Sau khi rút, bạn có thể nộp lại nếu tin vẫn mở và còn hạn.',
    to: '/user/dashboard', action: 'Xem đơn ứng tuyển', protected: true,
  },
];

export function findFaqTopic(message) {
  const text = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();
  const id = /theo doi|tien trinh|rut don|lich su|don da nop/.test(text) ? 'tracking' : /ung tuyen|nop (cv|ho so|don)/.test(text) ? 'apply' : /ho so|ky nang|cap nhat|kinh nghiem/.test(text) ? 'profile' : /tim viec|viec lam|loc|tuyen dung/.test(text) ? 'jobs' : null;
  return topics.find(topic => topic.id === id) || null;
}
