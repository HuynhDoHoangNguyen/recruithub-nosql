import { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';

export default function HomePage() {
  const [apiStatus, setApiStatus] = useState('Đang kiểm tra Backend...');

  useEffect(() => {
    let active = true;

    axiosClient.get('/health')
      .then((response) => {
        if (active) {
          setApiStatus(response.data.message);
        }
      })
      .catch((error) => {
        if (active) {
          setApiStatus('Không kết nối được Backend: ' + error.message);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <main style={{ padding: '40px', fontFamily: 'Arial' }}>
      <h1>RecruiHub NoSQL</h1>

      <p>Hệ thống quản lý tuyển dụng và phân tích hồ sơ ứng viên.</p>

      <h2>Trạng thái hệ thống</h2>
      <p><strong>Frontend:</strong> ReactJS + Vite</p>
      <p><strong>Backend:</strong> {apiStatus}</p>
      <p><strong>Database:</strong> Apache CouchDB</p>
    </main>
  );
}
