import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Navigation } from './components/layout/Navigation';
import { Dashboard } from './pages/Dashboard';
import { Adopt } from './pages/Adopt';
import { Community } from './pages/Community';
import { Exchange } from './pages/Exchange';
import { api } from './lib/api';
import { Motivation } from './pages/Motivation';


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [isApiOnline, setIsApiOnline] = useState(false);

  useEffect(() => {
    const checkApiHealth = async () => {
      try {
        await api.checkHealth();
        setIsApiOnline(true);
      } catch {
        setIsApiOnline(false);
      }
    };

    checkApiHealth();
    const interval = setInterval(checkApiHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const renderPage = () => {
    switch (activeTab) {
      case 'home':
        return <Dashboard />;
      case 'adopt':
        return <Adopt />;
      case 'map':
        return <Community />;
      case 'motivation':  // Add this case
        return <Motivation />;
      case 'exchange':
        return <Exchange />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gray-50">
        <Navigation
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isApiOnline={isApiOnline}
        />
        <main>{renderPage()}</main>
      </div>
    </QueryClientProvider>
  );
}

export default App;
