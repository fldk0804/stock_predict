import React, { useEffect, useState, useRef } from 'react';
import { format } from 'date-fns';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ChartData, ChartOptions } from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

interface NewsItem {
    title: string;
    publisher: string;
    link: string;
    published_at: number;
    type: string;
    thumbnail: string;
}

interface EducationResource {
    title: string;
    content: string;
    youtubeLink: string;
    category: string;
}

interface StockHistoryData {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    price: number;
}

interface StockNewsProps {
    symbol: string;
    stockName: string;
}

const StockNews: React.FC<StockNewsProps> = ({ symbol, stockName }) => {
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showAllNews, setShowAllNews] = useState(false);
    const [selectedEducation, setSelectedEducation] = useState<EducationResource | null>(null);
    const [historyData, setHistoryData] = useState<StockHistoryData[]>([]);
    const [zoomLevel, setZoomLevel] = useState<'all' | '10y' | '5y' | '1y'>('all');
    const [isZooming, setIsZooming] = useState(false);
    const [touchStartDistance, setTouchStartDistance] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const chartRef = useRef<ChartJS<"line">>(null);

    useEffect(() => {
        const fetchNews = async () => {
            if (!symbol) return;

            setLoading(true);
            setError(null);

            try {
                const response = await fetch(`http://localhost:8000/stock/${symbol}/news`);
                if (!response.ok) {
                    throw new Error(response.statusText || 'Failed to fetch news');
                }

                const data = await response.json();
                setNews(data.news || []);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch news');
                console.error('Error fetching news:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchNews();
    }, [symbol]);

    useEffect(() => {
        const fetchHistoricalData = async () => {
            if (!symbol) return;

            setIsLoading(true);
            setError(null);

            try {
                const period = zoomLevel === 'all' ? 'max' : zoomLevel;
                const response = await fetch(`http://localhost:8000/stock/${symbol}/history?period=${period}`);

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || 'Failed to fetch historical data');
                }

                const data = await response.json();
                if (!data.history || !Array.isArray(data.history)) {
                    throw new Error('Invalid data format received');
                }

                setHistoryData(data.history);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch historical data');
                console.error('Error fetching historical data:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchHistoricalData();
    }, [symbol, zoomLevel]);

    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            const distance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            setTouchStartDistance(distance);
            setIsZooming(true);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (isZooming && e.touches.length === 2 && touchStartDistance) {
            const currentDistance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );

            const zoomDelta = currentDistance - touchStartDistance;

            if (Math.abs(zoomDelta) > 50) {
                if (zoomDelta > 0) {
                    // Zoom in
                    setZoomLevel(prev => {
                        if (prev === 'all') return '10y';
                        if (prev === '10y') return '5y';
                        if (prev === '5y') return '1y';
                        return prev;
                    });
                } else {
                    // Zoom out
                    setZoomLevel(prev => {
                        if (prev === '1y') return '5y';
                        if (prev === '5y') return '10y';
                        if (prev === '10y') return 'all';
                        return prev;
                    });
                }
                setTouchStartDistance(currentDistance);
            }
        }
    };

    const handleTouchEnd = () => {
        setIsZooming(false);
        setTouchStartDistance(null);
    };

    const getFilteredHistoryData = () => {
        if (!historyData.length) return [];

        const now = new Date();
        const cutoffDate = new Date();

        switch (zoomLevel) {
            case '1y':
                cutoffDate.setFullYear(now.getFullYear() - 1);
                break;
            case '5y':
                cutoffDate.setFullYear(now.getFullYear() - 5);
                break;
            case '10y':
                cutoffDate.setFullYear(now.getFullYear() - 10);
                break;
            default:
                return historyData;
        }

        return historyData.filter(item => new Date(item.date) >= cutoffDate);
    };

    const displayedNews = showAllNews ? news : news.slice(0, 3);

    const educationContent: EducationResource[] = [
        {
            title: "Understanding Stock Market Basics",
            content: "Learn the fundamentals of stock markets, including how stocks work, market indices, and basic trading concepts. Perfect for beginners starting their investment journey.",
            youtubeLink: "https://www.youtube.com/watch?v=Xn7KWR9EOGQ",
            category: "Basics"
        },
        {
            title: "Technical Analysis Fundamentals",
            content: "Master the art of reading charts, identifying patterns, and using technical indicators to make informed trading decisions. Includes practical examples and real-world applications.",
            youtubeLink: "https://www.youtube.com/watch?v=eynxyoKgpng",
            category: "Technical"
        },
        {
            title: "Investment Strategies",
            content: "Explore different investment approaches, risk management techniques, and portfolio diversification strategies. Learn how to build a balanced and profitable investment portfolio.",
            youtubeLink: "https://www.youtube.com/watch?v=_f0VoxypcUE",
            category: "Strategy"
        },
        {
            title: "Risk Management in Trading",
            content: "Understanding risk management principles, position sizing, and how to protect your investments from market volatility. Essential knowledge for every trader.",
            youtubeLink: "https://www.youtube.com/watch?v=uMZxd7E3dOU",
            category: "Risk"
        }
    ];

    const chartOptions: ChartOptions<"line"> = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false,
        },
        plugins: {
            legend: {
                position: 'top',
            },
            title: {
                display: true,
                text: `${stockName} (${symbol}) Stock Price History`,
            },
            tooltip: {
                callbacks: {
                    label: (context) => {
                        return `$${context.parsed.y.toFixed(2)}`;
                    }
                }
            }
        },
        scales: {
            y: {
                ticks: {
                    callback: (value: number | string): string => {
                        if (typeof value === 'number') {
                            return `$${value.toFixed(2)}`;
                        }
                        return `$${value}`;
                    }
                }
            }
        }
    };

    const getChartData = (): ChartData<"line"> => {
        const filteredData = getFilteredHistoryData();
        return {
            labels: filteredData.map(item => format(new Date(item.date), 'MMM dd, yyyy')),
            datasets: [
                {
                    label: 'Stock Price',
                    data: filteredData.map(item => item.price),
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.5)',
                    tension: 0.1
                }
            ]
        };
    };

    return (
        <div className="space-y-6">
            {/* Stock Chart Section */}
            <div
                className="bg-white rounded-lg shadow p-4"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Price History</h2>
                    <div className="flex space-x-2">
                        <button
                            onClick={() => setZoomLevel('1y')}
                            className={`px-3 py-1 rounded ${zoomLevel === '1y' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                        >
                            1Y
                        </button>
                        <button
                            onClick={() => setZoomLevel('5y')}
                            className={`px-3 py-1 rounded ${zoomLevel === '5y' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                        >
                            5Y
                        </button>
                        <button
                            onClick={() => setZoomLevel('10y')}
                            className={`px-3 py-1 rounded ${zoomLevel === '10y' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                        >
                            10Y
                        </button>
                        <button
                            onClick={() => setZoomLevel('all')}
                            className={`px-3 py-1 rounded ${zoomLevel === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                        >
                            All
                        </button>
                    </div>
                </div>
                <div className="h-64 relative">
                    {error && (
                        <div className="flex items-center justify-center h-full text-red-500">
                            {error}
                        </div>
                    )}
                    {isLoading && (
                        <div className="flex items-center justify-center h-full text-gray-500">
                            Loading historical data...
                        </div>
                    )}
                    {!error && !isLoading && historyData.length > 0 && (
                        <Line ref={chartRef} options={chartOptions} data={getChartData()} />
                    )}
                    {!error && !isLoading && historyData.length === 0 && (
                        <div className="flex items-center justify-center h-full text-gray-500">
                            No historical data available
                        </div>
                    )}
                    <div className="text-sm text-gray-500 mt-2 text-center">
                        Use two fingers to pinch zoom for more detail
                    </div>
                </div>
            </div>

            {/* Latest News Section */}
            <div className="bg-white rounded-lg shadow p-4">
                <h2 className="text-xl font-bold mb-4">Latest News</h2>
                <div className="space-y-4">
                    {displayedNews.map((item, index) => (
                        <div key={`news-${index}`} className="border-b pb-4">
                            <a
                                href={item.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-blue-600 transition-colors"
                            >
                                <h3 className="font-semibold">{item.title}</h3>
                                <div className="flex justify-between text-sm text-gray-600">
                                    <span>{item.publisher}</span>
                                    <span>{format(new Date(item.published_at * 1000), 'MMM dd, yyyy')}</span>
                                </div>
                            </a>
                        </div>
                    ))}
                </div>
                {news.length > 3 && (
                    <button
                        onClick={() => setShowAllNews(!showAllNews)}
                        className="mt-4 text-blue-600 hover:text-blue-800 transition-colors"
                    >
                        {showAllNews ? 'Show Less' : 'See More'}
                    </button>
                )}
            </div>

            {/* Educational Content Section */}
            <div className="bg-white rounded-lg shadow p-4">
                <h2 className="text-xl font-bold mb-4">Educational Resources</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {educationContent.map((item, index) => (
                        <div
                            key={`edu-${index}`}
                            className="border rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer"
                            onClick={() => setSelectedEducation(item)}
                        >
                            <div className="flex flex-col mb-2">
                                <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded w-fit">
                                    {item.category}
                                </span>
                            </div>
                            <p className="text-gray-600 text-sm mb-3 line-clamp-2">{item.content}</p>
                            <button className="text-blue-600 hover:text-blue-800 text-sm">
                                Learn More →
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Education Resource Modal */}
            {selectedEducation && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg max-w-3xl w-full mx-4 p-6 relative">
                        <button
                            onClick={() => setSelectedEducation(null)}
                            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        <div className="mb-6 pt-2">
                            <div className="flex flex-col mb-4">
                                <h2 className="text-2xl font-bold mb-2">{selectedEducation.title}</h2>
                                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm w-fit">
                                    {selectedEducation.category}
                                </span>
                            </div>
                            <p className="text-gray-700 mb-6">{selectedEducation.content}</p>

                            <div className="bg-gray-50 rounded-lg p-4">
                                <h3 className="font-semibold mb-2">Recommended Video</h3>
                                <a
                                    href={selectedEducation.youtubeLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center text-blue-600 hover:text-blue-800"
                                >
                                    <svg className="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
                                    </svg>
                                    Watch Tutorial Video
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StockNews; 