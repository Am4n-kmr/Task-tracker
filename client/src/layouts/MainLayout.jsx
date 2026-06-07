import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

export default function MainLayout() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main 
        className="flex-1 overflow-auto"
        style={{ backgroundColor: 'var(--bg-secondary)' }}
      >
        <div className="p-4 lg:p-8 pt-16 lg:pt-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}