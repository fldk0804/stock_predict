import React, { useEffect, useState, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ChartData, ChartOptions } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { config } from '../config';

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

interface PredictionData {
    dates: string[];
    predictions: number[];
    upper_bound: number[];
    lower_bound: number[];
    last_actual: number;
    last_actual_date: string;
}

interface StockNewsProps {
    symbol: string;
    stockName: string;
}

// Extend Math interface
declare global {
    interface Math {
        std(array: number[]): number;
    }
}

// Add the std function to Math object
Math.std = function (array: number[]) {
    const n = array.length;
    const mean = array.reduce((a, b) => a + b) / n;
    return Math.sqrt(array.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n);
};

const StockNews: React.FC<StockNewsProps> = ({ symbol, stockName }) => {
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showAllNews, setShowAllNews] = useState(false);
    const [selectedEducation, setSelectedEducation] = useState<EducationResource | null>(null);
    const [historyData, setHistoryData] = useState<StockHistoryData[]>([]);
    const [zoomLevel, setZoomLevel] = useState<'all' | '10y' | '5y' | '1y'>('1y');
    const [isLoading, setIsLoading] = useState(false);
    const [isNewsExpanded, setIsNewsExpanded] = useState(false);
    const [isEducationExpanded, setIsEducationExpanded] = useState(false);
    const chartRef = useRef<ChartJS<"line">>(null);
    const [touchStartDistance, setTouchStartDistance] = useState<number | null>(null);
    const [isZooming, setIsZooming] = useState(false);
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const [predictionData, setPredictionData] = useState<PredictionData | null>(null);
    const [showAnalysis, setShowAnalysis] = useState(false);

    useEffect(() => {
        const fetchNews = async () => {
            if (!symbol) return;

            setLoading(true);
            setError(null);

            try {
                const response = await fetch(`${config.API_BASE_URL}/stock/${symbol}/news`);
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
                const response = await fetch(`${config.API_BASE_URL}/stock/${symbol}/history?period=${period}`);

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

    useEffect(() => {
        const fetchPredictions = async () => {
            if (!symbol) return;

            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch(`${config.API_BASE_URL}/stock/${symbol}/predict`);
                if (!response.ok) {
                    throw new Error(response.statusText || 'Failed to fetch predictions');
                }

                const data = await response.json();
                setPredictionData(data);
            } catch (err) {
                console.error('Error fetching predictions:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPredictions();
    }, [symbol]);

    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            e.preventDefault(); // Prevent default zoom behavior
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
            e.preventDefault(); // Prevent default zoom behavior
            const currentDistance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );

            const zoomDelta = currentDistance - touchStartDistance;
            const ZOOM_SENSITIVITY = 50; // Reduced sensitivity for better control

            if (Math.abs(zoomDelta) > ZOOM_SENSITIVITY) {
                // Pinch in = see longer history (zoom out)
                if (zoomDelta < 0) {
                    setZoomLevel(prev => {
                        switch (prev) {
                            case '1y': return '5y';
                            case '5y': return '10y';
                            case '10y': return 'all';
                            default: return prev;
                        }
                    });
                }
                // Pinch out = see recent history (zoom in)
                else {
                    setZoomLevel(prev => {
                        switch (prev) {
                            case 'all': return '10y';
                            case '10y': return '5y';
                            case '5y': return '1y';
                            default: return prev;
                        }
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
            mode: 'nearest',
            axis: 'x',
            intersect: false
        },
        plugins: {
            legend: {
                position: 'top',
            },
            title: {
                display: true,
                text: `${stockName} (${symbol}) Stock Price History & Prediction`,
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
                beginAtZero: false,
                ticks: {
                    callback: (value) => `$${value}`
                }
            },
            x: {
                ticks: {
                    maxRotation: 45,
                    minRotation: 45,
                    callback: (value, index, values) => {
                        if (index < historyData.length) {
                            return format(new Date(historyData[index].date), 'MMM yyyy');
                        } else if (predictionData?.dates[index - historyData.length]) {
                            return format(parseISO(predictionData.dates[index - historyData.length]), 'MMM yyyy');
                        }
                        return '';
                    },
                    maxTicksLimit: 12
                }
            }
        }
    };

    const getChartData = (): ChartData<"line"> => {
        const filteredData = getFilteredHistoryData();
        const datasets: any[] = [
            {
                label: 'Historical Price',
                data: filteredData.map(item => item.price),
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.5)',
                tension: 0.1
            }
        ];

        if (predictionData) {
            // Add prediction line
            datasets.push({
                label: 'Predicted Price',
                data: Array(filteredData.length).fill(null).concat(predictionData.predictions),
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgba(255, 99, 132, 0.5)',
                borderDash: [5, 5],
                tension: 0.1
            });

            // Add confidence interval
            datasets.push({
                label: 'Confidence Interval',
                data: Array(filteredData.length).fill(null).concat(predictionData.upper_bound),
                borderColor: 'rgba(255, 99, 132, 0.2)',
                backgroundColor: 'rgba(255, 99, 132, 0.1)',
                borderDash: [2, 2],
                pointRadius: 0,
                fill: '+1'
            });

            datasets.push({
                data: Array(filteredData.length).fill(null).concat(predictionData.lower_bound),
                borderColor: 'rgba(255, 99, 132, 0.2)',
                backgroundColor: 'rgba(255, 99, 132, 0.1)',
                borderDash: [2, 2],
                pointRadius: 0,
                fill: false,
                showLine: true
            });
        }

        return {
            labels: [
                ...filteredData.map(item => format(new Date(item.date), 'MMM dd, yyyy')),
                ...(predictionData?.dates || [])
            ],
            datasets
        };
    };

    const getMarketSentiment = (predictions: number[], lastPrice: number) => {
        const lastPrediction = predictions[predictions.length - 1];
        const percentChange = ((lastPrediction - lastPrice) / lastPrice) * 100;

        if (percentChange > 10) return 'Strongly Bullish';
        if (percentChange > 5) return 'Bullish';
        if (percentChange > -5) return 'Neutral';
        if (percentChange > -10) return 'Bearish';
        return 'Strongly Bearish';
    };

    const getMarketFactors = (predictions: number[], lastPrice: number) => {
        const trend = predictions.every((price, index) =>
            index === 0 || price >= predictions[index - 1]
        ) ? 'upward' : predictions.every((price, index) =>
            index === 0 || price <= predictions[index - 1]
        ) ? 'downward' : 'mixed';

        const volatility = Math.std(predictions) / lastPrice * 100;
        const isHighVolatility = volatility > 5;

        return {
            trend,
            volatility: isHighVolatility ? 'High' : 'Moderate to Low',
            confidence: 100 - (volatility * 10) // Simple confidence score
        };
    };

    return (
        <div className="flex flex-col min-h-screen">
            <div className="flex flex-1 justify-center">
                {/* Main Chart Section (centered, reduced width) */}
                <div className="w-2/3 max-w-3xl p-4">
                    <div className="bg-white rounded-lg shadow h-full p-4">
                        <div className="flex justify-between items-center p-4">
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
                        <div className="h-[calc(100%-5rem)] relative">
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
                        </div>
                    </div>
                </div>

                {/* Sidebar Section (1/4 width) */}
                <div className="w-1/4 p-4 space-y-4">
                    {/* Latest News Section */}
                    <div className="bg-white rounded-lg shadow p-4">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">Latest News</h2>
                            <button
                                onClick={() => setIsNewsExpanded(true)}
                                className="text-blue-600 hover:text-blue-800"
                            >
                                Expand
                            </button>
                        </div>
                        <div className="space-y-4 max-h-[300px] overflow-y-auto">
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
                    </div>

                    {/* Educational Content Section */}
                    <div className="bg-white rounded-lg shadow p-4">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">Educational Resources</h2>
                            <button
                                onClick={() => setIsEducationExpanded(true)}
                                className="text-blue-600 hover:text-blue-800"
                            >
                                Expand
                            </button>
                        </div>
                        <div className="space-y-4 max-h-[300px] overflow-y-auto">
                            {educationContent.slice(0, 2).map((item, index) => (
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
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* New Analysis Section */}
            {predictionData && (
                <div className="w-full px-8 pb-8 flex justify-center">
                    <div className="bg-white rounded-lg shadow p-4 w-full max-w-5xl">
                        <div className="mb-4">
                            <h2 className="text-xl font-bold">Market Analysis & Prediction Insights</h2>
                        </div>
                        <div className="space-y-6">
                            {/* Market Sentiment */}
                            <div className="flex items-center justify-between border-b pb-4">
                                <div>
                                    <h3 className="font-semibold text-lg mb-1">Market Sentiment</h3>
                                    <p className="text-gray-600">
                                        {getMarketSentiment(predictionData.predictions, predictionData.last_actual)}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-gray-500">Last Price</p>
                                    <p className="font-semibold">${predictionData.last_actual.toFixed(2)}</p>
                                </div>
                            </div>
                            {/* Prediction Analysis */}
                            <div className="grid grid-cols-3 gap-6">
                                <div className="border rounded-lg p-4">
                                    <h4 className="font-semibold mb-2">Price Trend</h4>
                                    <p className="text-gray-600">
                                        The model predicts a {getMarketFactors(predictionData.predictions, predictionData.last_actual).trend} trend
                                        over the next 30 days, based on historical patterns and current market conditions.
                                    </p>
                                </div>
                                <div className="border rounded-lg p-4">
                                    <h4 className="font-semibold mb-2">Volatility Assessment</h4>
                                    <p className="text-gray-600">
                                        Expected volatility is {getMarketFactors(predictionData.predictions, predictionData.last_actual).volatility}.
                                        This is reflected in the confidence interval shown in the chart.
                                    </p>
                                </div>
                                <div className="border rounded-lg p-4">
                                    <h4 className="font-semibold mb-2">Prediction Confidence</h4>
                                    <div className="flex items-center">
                                        <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                                            <div
                                                className="bg-blue-600 h-2 rounded-full"
                                                style={{ width: `${getMarketFactors(predictionData.predictions, predictionData.last_actual).confidence}%` }}
                                            />
                                        </div>
                                        <span className="text-sm text-gray-600">
                                            {getMarketFactors(predictionData.predictions, predictionData.last_actual).confidence.toFixed(1)}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                            {/* Key Factors */}
                            <div>
                                <h3 className="font-semibold text-lg mb-3">Key Influencing Factors</h3>
                                <ul className="list-disc pl-5 space-y-2 text-gray-600">
                                    <li>Historical price patterns and trends over the past year</li>
                                    <li>Market volatility and standard deviation of price movements</li>
                                    <li>Current market momentum and trend direction</li>
                                    <li>Note: This prediction model uses linear regression and does not account for external factors such as:
                                        <ul className="list-circle pl-5 mt-2 space-y-1">
                                            <li>Company-specific news and events</li>
                                            <li>Overall market conditions and economic indicators</li>
                                            <li>Industry trends and competitive landscape</li>
                                            <li>Global economic and political events</li>
                                        </ul>
                                    </li>
                                </ul>
                            </div>
                            {/* Disclaimer */}
                            <div className="mt-6 text-sm text-gray-500 bg-gray-50 p-4 rounded">
                                <p><strong>Disclaimer:</strong> This prediction is based on historical data analysis and mathematical models.
                                    Financial markets are inherently unpredictable and subject to numerous external factors.
                                    This analysis should not be considered as financial advice. Always conduct your own research and consult with financial professionals before making investment decisions.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* News Expanded Modal */}
            {isNewsExpanded && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg w-3/4 h-3/4 p-6 relative overflow-hidden">
                        <button
                            onClick={() => setIsNewsExpanded(false)}
                            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <h2 className="text-2xl font-bold mb-4">Latest News</h2>
                        <div className="overflow-y-auto h-[calc(100%-4rem)]">
                            {news.map((item, index) => (
                                <div key={`news-expanded-${index}`} className="border-b pb-4 mb-4">
                                    <a
                                        href={item.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="hover:text-blue-600 transition-colors"
                                    >
                                        <h3 className="font-semibold text-lg">{item.title}</h3>
                                        <div className="flex justify-between text-sm text-gray-600 mt-2">
                                            <span>{item.publisher}</span>
                                            <span>{format(new Date(item.published_at * 1000), 'MMM dd, yyyy')}</span>
                                        </div>
                                    </a>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Education Expanded Modal */}
            {isEducationExpanded && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg w-3/4 h-3/4 p-6 relative overflow-hidden">
                        <button
                            onClick={() => setIsEducationExpanded(false)}
                            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <h2 className="text-2xl font-bold mb-4">Educational Resources</h2>
                        <div className="overflow-y-auto h-[calc(100%-4rem)] grid grid-cols-2 gap-4">
                            {educationContent.map((item, index) => (
                                <div
                                    key={`edu-expanded-${index}`}
                                    className="border rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer"
                                    onClick={() => setSelectedEducation(item)}
                                >
                                    <div className="flex flex-col mb-2">
                                        <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded w-fit">
                                            {item.category}
                                        </span>
                                    </div>
                                    <p className="text-gray-600 text-sm mb-3">{item.content}</p>
                                    <button className="text-blue-600 hover:text-blue-800 text-sm">
                                        Learn More →
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

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