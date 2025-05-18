import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
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

interface StockHistory {
  dates: string[];
  prices: number[];
  volumes: number[];
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
  const [stockHistory, setStockHistory] = useState<StockHistory | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const [isEducationExpanded, setIsEducationExpanded] = useState(false);
  const [stockKnowledge, setStockKnowledge] = useState<StockKnowledge[]>([]);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query || query.length < 1) {
      setSuggestions([]);
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await axios.get(`http://localhost:8000/search/${query}`);
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
      const [stockResponse, historyResponse] = await Promise.all([
        axios.get(`http://localhost:8000/stock/${symbol}`),
        axios.get(`http://localhost:8000/stock/${symbol}/history`)
      ]);

      setSelectedStock(stockResponse.data);
      setStockHistory(historyResponse.data);
      setSuggestions([]);
      setSearchTerm('');
    } catch (err) {
      console.error('Error fetching stock data:', err);
      setError('Error fetching stock data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Mock function to get stock-specific knowledge (replace with real API call)
  const getStockKnowledge = (symbol: string) => {
    const knowledge: { [key: string]: StockKnowledge[] } = {
      'TSLA': [
        {
          category: 'Company Fundamentals',
          points: [
            'Tesla is a leader in electric vehicle manufacturing',
            'Strong focus on autonomous driving technology',
            'Expanding into energy storage and solar power',
            'High reliance on regulatory credits for profitability'
          ]
        },
        {
          category: 'Market Factors',
          points: [
            'Stock price sensitive to CEO Elon Musk\'s public statements',
            'Competition increasing in EV market',
            'Global supply chain challenges affect production',
            'Battery technology advances crucial for growth'
          ]
        }
      ],
      // Add more stocks here
    };
    return knowledge[symbol] || [];
  };

  // Update education content when stock is selected
  useEffect(() => {
    if (selectedStock) {
      // Set stock knowledge
      setStockKnowledge(getStockKnowledge(selectedStock.symbol));
    }
  }, [selectedStock]);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        {/* Search Section */}
        <div className="mb-8">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Search for stocks..."
              className="w-full p-4 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {loading && (
              <div className="absolute right-4 top-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              </div>
            )}
          </div>
          {error && <p className="text-red-500 mt-2">{error}</p>}
          {suggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-96 overflow-y-auto">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => fetchStockData(suggestion.symbol)}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                >
                  <div className="font-medium">{suggestion.symbol}</div>
                  <div className="text-sm text-gray-600">{suggestion.name}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Stock Information */}
        {selectedStock && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Chart and Info Section */}
            <div className="space-y-8">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-2xl font-bold mb-4">{selectedStock.name} ({selectedStock.symbol})</h2>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <p className="text-gray-600">Current Price</p>
                    <p className="text-2xl font-bold">${selectedStock.price.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Change</p>
                    <p className={`text-2xl font-bold ${selectedStock.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {selectedStock.change >= 0 ? '+' : ''}{selectedStock.change.toFixed(2)}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Stock Chart */}
              {stockHistory && (
                <div className="bg-white rounded-lg shadow p-6">
                  <Line
                    data={{
                      labels: stockHistory.dates,
                      datasets: [
                        {
                          label: 'Stock Price',
                          data: stockHistory.prices,
                          borderColor: 'rgb(75, 192, 192)',
                          tension: 0.1
                        }
                      ]
                    }}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: {
                          position: 'top' as const,
                        },
                        title: {
                          display: true,
                          text: 'Stock Price History'
                        }
                      }
                    }}
                  />
                </div>
              )}
            </div>

            {/* News and Educational Content */}
            <div>
              <StockNews symbol={selectedStock.symbol} stockName={selectedStock.name} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
