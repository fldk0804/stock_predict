export interface StockData {
    symbol: string;
    company_name: string;
    current_price: number;
    currency: string;
    market_cap: number;
    fifty_two_week_high: number;
    fifty_two_week_low: number;
    historical_data: HistoricalDataPoint[];
}

export interface HistoricalDataPoint {
    Date: string;
    Open: number;
    High: number;
    Low: number;
    Close: number;
    Volume: number;
}

export interface StockSearchResult {
    symbol: string;
    name: string;
    exchange: string;
    type: string;
} 