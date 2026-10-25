import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import AppRoutes from './routes/AppRoutes';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import TestToolbar from './components/TestToolbar';

function App() {
	return (
		<BrowserRouter>
			<AuthProvider>
				<Navbar />
				<AppRoutes />
				<TestToolbar />
				<ToastContainer position="top-right" autoClose={3000} />
			</AuthProvider>
		</BrowserRouter>
	);
}

export default App;
