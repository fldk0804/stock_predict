import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import StockNews from './components/StockNews';
import { config } from './config';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  volume: number;
  market_cap: number;
  currency: string;
}

interface StockSuggestion {
  symbol: string;
  name: string;
  exchange: string;
}

interface StockNews {
  title: string;
  summary: string;
  url: string;
  publishedDate: string;
}

interface StockKnowledge {
  category: string;
  points: string[];
}

function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<StockSuggestion[]>([]);
  const [selectedStock, setSelectedStock] = useState<StockData | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query || query.length < 1) {
      setSuggestions([]);
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await axios.get(`${config.API_BASE_URL}/search/${query}`);
      if (response.data.error) {
        setError(response.data.error);
        setSuggestions([]);
      } else {
        const sortedSuggestions = (response.data.suggestions || []).sort((a: StockSuggestion, b: StockSuggestion) => {
          if (a.symbol === query.toUpperCase()) return -1;
          if (b.symbol === query.toUpperCase()) return 1;

          const aStartsWith = a.symbol.startsWith(query.toUpperCase());
          const bStartsWith = b.symbol.startsWith(query.toUpperCase());
          if (aStartsWith && !bStartsWith) return -1;
          if (!aStartsWith && bStartsWith) return 1;

          const aContains = a.symbol.includes(query.toUpperCase());
          const bContains = b.symbol.includes(query.toUpperCase());
          if (aContains && !bContains) return -1;
          if (!aContains && bContains) return 1;

          return 0;
        });
        setSuggestions(sortedSuggestions);
      }
    } catch (err) {
      console.error('Error fetching suggestions:', err);
      setError('Error fetching suggestions. Please try again.');
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = useCallback((value: string) => {
    setSearchTerm(value);
    setError('');

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      fetchSuggestions(value);
    }, 150);
  }, [fetchSuggestions, setSearchTerm, setError]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    handleSearch(value);
  };

  const fetchStockData = async (symbol: string) => {
    try {
      setLoading(true);
      setError('');
      const stockResponse = await axios.get(`${config.API_BASE_URL}/stock/${symbol}`);

      setSelectedStock(stockResponse.data);
      setSuggestions([]);
      setSearchTerm('');
    } catch (err) {
      console.error('Error fetching stock data:', err);
      setError('Error fetching stock data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!selectedStock && !loading) {
      document.body.classList.add('water-bg');
    } else {
      document.body.classList.remove('water-bg');
    }
    return () => {
      document.body.classList.remove('water-bg');
    };
  }, [selectedStock, loading]);

  return (
    <div style={{ background: 'linear-gradient(120deg, #2563eb 0%, #60a5fa 50%, #ffffff 100%)', backgroundSize: '200% 200%', animation: 'waterMove 10s ease-in-out infinite' }} className={(!selectedStock && !loading) ? "min-h-screen flex items-center justify-center" : "relative min-h-screen flex items-center justify-center"}>
      <div className="relative z-10 w-full flex flex-col items-center justify-center">
        {!selectedStock && !loading && (
          <div className="flex flex-col items-center justify-center min-h-[80vh]">
            <div className="bg-white bg-opacity-90 rounded-2xl shadow-2xl px-10 py-12 flex flex-col items-center max-w-lg w-full border-4 border-blue-300 ring-4 ring-blue-200" style={{ boxShadow: '0 8px 40px 8px rgba(59,130,246,0.10)' }}>
              <img src="/lya-logo.png" alt="Stock Predictor Logo" className="w-24 h-24 mb-6 drop-shadow-lg" />
              <h1 className="text-5xl font-extrabold mb-4 text-blue-700 text-center">Welcome to Stock Predictor</h1>
              <p className="text-xl text-gray-700 mb-4 text-center">Predict the future of your favorite stocks with AI-powered insights.</p>
              <p className="text-md text-gray-500 mb-8 text-center">Start by searching for a stock symbol or company name below.</p>
              <div className="w-full flex flex-col items-center">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={handleSearchChange}
                  placeholder="Search for stocks..."
                  className="w-72 max-w-full p-4 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
                />
                {suggestions.length > 0 && (
                  <div className="z-10 w-72 max-w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-96 overflow-y-auto">
                    {suggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => fetchStockData(suggestion.symbol)}
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 focus:outline-none focus:bg-gray-100"
                      >
                        <span className="font-medium">{suggestion.symbol}</span>
                        <span className="text-gray-600 ml-2">{suggestion.name}</span>
                        <span className="text-gray-400 text-sm ml-2">({suggestion.exchange})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-2 mt-6">
                <span className="inline-block w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
                <span className="text-sm text-blue-400">Real-time data • Free to use • No signup required</span>
              </div>
            </div>
          </div>
        )}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24">
            <img src="https://upload.wikimedia.org/wikipedia/commons/b/b1/Loading_icon.gif" alt="Loading..." className="w-20 h-20 mb-4" />
            <p className="text-lg text-blue-600">Loading...</p>
          </div>
        )}
        {/* Search Section */}
        {selectedStock && (
          <div className="w-full px-4 sm:px-6 lg:px-8 flex flex-col items-center">
            <div className="bg-white rounded-xl shadow px-4 sm:px-8 py-6 w-full max-w-2xl mx-auto mt-8 flex flex-col items-center justify-center">
              <input
                type="text"
                value={searchTerm}
                onChange={handleSearchChange}
                placeholder="Search for stocks..."
                className="w-full p-4 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {suggestions.length > 0 && (
                <div className="absolute z-10 w-full max-w-2xl mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-96 overflow-y-auto">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => fetchStockData(suggestion.symbol)}
                      className="w-full px-4 py-2 text-left hover:bg-gray-100 focus:outline-none focus:bg-gray-100"
                    >
                      <span className="font-medium">{suggestion.symbol}</span>
                      <span className="text-gray-600 ml-2">{suggestion.name}</span>
                      <span className="text-gray-400 text-sm ml-2">({suggestion.exchange})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="mb-8 p-4 bg-red-100 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {selectedStock && (
          <StockNews symbol={selectedStock.symbol} stockName={selectedStock.name} />
        )}
      </div>
    </div>
  );
}

export default App;
