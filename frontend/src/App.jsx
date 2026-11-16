import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import FaqChatbox from './components/support/FaqChatbox';

import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function App() {
	return (
		<BrowserRouter>
			<AuthProvider>
				<Navbar />
				<AppRoutes />
				<FaqChatbox />
				<ToastContainer position="top-right" autoClose={3000} />
			</AuthProvider>
		</BrowserRouter>
	);
}

export default App;
