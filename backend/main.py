from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import time
from typing import Dict, List, Optional
import json
import requests
from datetime import datetime, timedelta
import random
from collections import defaultdict
import functools
import asyncio
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Enhanced caching configuration
CACHE_DURATIONS = {
    'search': 600,     # 10 minutes for search results
    'stock': 60,       # 1 minute for stock data
    'history': 300,    # 5 minutes for historical data
    'live': 30,        # 30 seconds for live prices
    'news': 300        # 5 minutes for news
}

# Rate limiting configuration
RATE_LIMITS = {
    'search': {'requests': 30, 'window': 60},    # 30 requests per minute
    'stock': {'requests': 30, 'window': 60},     # 30 requests per minute
    'history': {'requests': 30, 'window': 60},   # 30 requests per minute
    'live': {'requests': 60, 'window': 60},      # 60 requests per minute
    'news': {'requests': 10, 'window': 60}       # 10 requests per minute
}

# Cache storage with size limits
MAX_CACHE_ITEMS = {
    'search': 2000,    # Increased cache size for search
    'stock': 500,
    'history': 200,
    'live': 100,
    'news': 100
}

# Cache storage
cache_store = {
    'search': {},
    'stock': {},
    'history': {},
    'live': {},
    'news': {}
}

# Rate limiting storage
request_counts = defaultdict(list)

def is_rate_limited(endpoint_type: str) -> bool:
    """Check if the endpoint is rate limited with sliding window"""
    current_time = time.time()
    window_start = current_time - RATE_LIMITS[endpoint_type]['window']
    
    # Clean up old requests
    request_counts[endpoint_type] = [
        timestamp for timestamp in request_counts[endpoint_type]
        if timestamp > window_start
    ]
    
    # Check if we're over the limit
    if len(request_counts[endpoint_type]) >= RATE_LIMITS[endpoint_type]['requests']:
        return True
    
    # Add current request
    request_counts[endpoint_type].append(current_time)
    return False

def get_cached_data(cache_type: str, key: str):
    """Get data from cache if valid"""
    if key in cache_store[cache_type]:
        timestamp, data = cache_store[cache_type][key]
        if time.time() - timestamp < CACHE_DURATIONS[cache_type]:
            return data
        # If data is expired but we're rate limited, return it anyway
        if is_rate_limited(cache_type):
            return data
    return None

def set_cached_data(cache_type: str, key: str, data):
    """Set data in cache with size limit enforcement"""
    if len(cache_store[cache_type]) >= MAX_CACHE_ITEMS[cache_type]:
        # Remove oldest items when cache is full
        oldest_key = min(cache_store[cache_type].items(), key=lambda x: x[1][0])[0]
        del cache_store[cache_type][oldest_key]
    cache_store[cache_type][key] = (time.time(), data)

def make_api_request(url: str, headers: dict = None, params: dict = None, max_retries: int = 5, initial_delay: float = 2.0) -> dict:
    """Make API request with retries and exponential backoff"""
    headers = headers or {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    for attempt in range(max_retries):
        try:
            response = requests.get(url, headers=headers, params=params, timeout=10)
            if response.status_code == 429:  # Too Many Requests
                delay = initial_delay * (2 ** attempt)  # Exponential backoff
                time.sleep(delay)
                continue
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            if attempt == max_retries - 1:
                raise e
            delay = initial_delay * (2 ** attempt)
            time.sleep(delay)
    
    raise Exception("Max retries exceeded")

def cache_with_timeout(duration):
    def decorator(func):
        cache = {}
        
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            key = str(args) + str(kwargs)
            now = time.time()
            
            if key in cache:
                result, timestamp = cache[key]
                if now - timestamp < duration:
                    return result
                
            result = func(*args, **kwargs)
            cache[key] = (result, now)
            return result
        return wrapper
    return decorator

@app.get("/")
def read_root():
    return {"message": "Welcome to Stock Prediction API"}

@app.get("/search/{query}")
async def search_stocks(query: str):
    try:
        # Clean and validate query
        query = query.strip()
        if not query:
            return {"suggestions": []}

        # Check rate limiting
        if is_rate_limited('search'):
            # Try to return cached data if available
            cached_data = get_cached_data('search', query)
            if cached_data:
                return cached_data
            return {"suggestions": [], "error": "Rate limit exceeded. Please try again later."}

        # Check cache first
        cached_data = get_cached_data('search', query)
        if cached_data:
            return cached_data

        # Initialize parameters
        url = "https://query1.finance.yahoo.com/v1/finance/search"
        params = {
            "q": query,
            "quotesCount": 20,
            "newsCount": 0,
            "enableFuzzyQuery": "True",
            "quotesQueryId": "tss_match_phrase_query",
            "multiQuoteQueryId": "multi_quote_single_token_query",
            "enableCb": "True",
            "enableNavLinks": "True",
            "enableEnhancedTrivialQuery": "True"
        }
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }

        try:
            # Use make_api_request helper for better retry logic
            data = make_api_request(url, headers=headers, params=params)
            
            quotes = data.get("quotes", [])
            
            # Filter and process results
            suggestions = [
                {
                    "symbol": quote["symbol"],
                    "name": quote.get("shortname", quote.get("longname", "Unknown")),
                    "exchange": quote.get("exchange", "")
                }
                for quote in quotes
                if quote.get("symbol") and (quote.get("shortname") or quote.get("longname"))
            ]
            
            result = {"suggestions": suggestions}
            # Cache the result
            set_cached_data('search', query, result)
            return result
            
        except Exception as e:
            print(f"Error in search_stocks: {str(e)}")
            # Try to return cached data on error
            cached_data = get_cached_data('search', query)
            if cached_data:
                return cached_data
            return {"suggestions": [], "error": "Failed to fetch suggestions. Please try again."}
                
    except Exception as e:
        print(f"Error in search_stocks: {str(e)}")
        return {"suggestions": [], "error": "Failed to fetch suggestions. Please try again."}

@app.get("/stock/{symbol}")
async def get_stock_data(symbol: str):
    try:
        # Check rate limiting
        if is_rate_limited('stock'):
            cached_data = get_cached_data('stock', symbol)
            if cached_data:
                return cached_data
            raise HTTPException(status_code=429, detail="Rate limit exceeded. Please try again later.")

        # Check cache
        cached_data = get_cached_data('stock', symbol)
        if cached_data:
            return cached_data

        # Initialize retry parameters
        max_retries = 3
        retry_delay = 2
        last_error = None

        for attempt in range(max_retries):
            try:
                url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
                response = requests.get(url, headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                })
                
                if response.status_code == 429:
                    await asyncio.sleep(retry_delay * (2 ** attempt))
                    continue
                    
                response.raise_for_status()
                data = response.json()
                
                if 'chart' not in data or 'result' not in data['chart'] or not data['chart']['result']:
                    raise HTTPException(status_code=404, detail=f"Stock {symbol} not found")
                    
                result = data['chart']['result'][0]
                meta = result['meta']
                
                # Extract relevant data
                stock_data = {
                    "symbol": symbol,
                    "name": meta.get("instrumentType", ""),
                    "price": meta.get("regularMarketPrice", 0),
                    "change": meta.get("regularMarketChange", 0),
                    "changePercent": meta.get("regularMarketChangePercent", 0),
                    "volume": meta.get("regularMarketVolume", 0),
                    "high": meta.get("regularMarketDayHigh", 0),
                    "low": meta.get("regularMarketDayLow", 0),
                }

                # Cache the result
                set_cached_data('stock', symbol, stock_data)
                return stock_data

            except requests.exceptions.RequestException as e:
                last_error = str(e)
                if attempt < max_retries - 1:
                    await asyncio.sleep(retry_delay * (2 ** attempt))
                    continue
                break

        # If all retries failed, return error
        raise HTTPException(
            status_code=503,
            detail=f"Failed to fetch data for '{symbol}'. Service temporarily unavailable."
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching stock {symbol}: {str(e)}"
        )

@app.get("/stock/{symbol}/history")
async def get_stock_history(symbol: str, period: str = "1mo", interval: str = "1d"):
    try:
        # Check rate limiting
        if is_rate_limited('history'):
            cached_data = get_cached_data('history', f"{symbol}_{period}_{interval}")
            if cached_data:
                return cached_data
            raise HTTPException(status_code=429, detail="Rate limit exceeded. Please try again later.")

        # Check cache
        cache_key = f"{symbol}_{period}_{interval}"
        cached_data = get_cached_data('history', cache_key)
        if cached_data:
            return cached_data

        # Initialize retry parameters
        max_retries = 3
        retry_delay = 2
        last_error = None

        # Convert period to timestamp
        period_seconds = {
            "1d": 24 * 60 * 60,
            "5d": 5 * 24 * 60 * 60,
            "1mo": 30 * 24 * 60 * 60,
            "3mo": 90 * 24 * 60 * 60,
            "6mo": 180 * 24 * 60 * 60,
            "1y": 365 * 24 * 60 * 60,
            "2y": 2 * 365 * 24 * 60 * 60,
            "5y": 5 * 365 * 24 * 60 * 60,
            "10y": 10 * 365 * 24 * 60 * 60,
            "max": int(time.time())
        }

        end = int(time.time())
        start = end - period_seconds.get(period, period_seconds["1mo"])

        for attempt in range(max_retries):
            try:
                url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
                params = {
                    "period1": start,
                    "period2": end,
                    "interval": interval,
                    "events": "history"
                }
                
                headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }

                response = requests.get(url, params=params, headers=headers)
                
                if response.status_code == 429:
                    await asyncio.sleep(retry_delay * (2 ** attempt))
                    continue
                    
                response.raise_for_status()
                data = response.json()

                if 'chart' not in data or 'result' not in data['chart'] or not data['chart']['result']:
                    raise HTTPException(
                        status_code=404,
                        detail=f"{symbol}: No price data found for period={period}"
                    )

                result = data['chart']['result'][0]
                timestamps = result['timestamp']
                quotes = result['indicators']['quote'][0]
                
                history_data = []
                for i in range(len(timestamps)):
                    if all(quotes[key][i] is not None for key in ['open', 'high', 'low', 'close', 'volume']):
                        history_data.append({
                            "date": datetime.fromtimestamp(timestamps[i]).strftime('%Y-%m-%d'),
                            "open": float(quotes['open'][i]),
                            "high": float(quotes['high'][i]),
                            "low": float(quotes['low'][i]),
                            "close": float(quotes['close'][i]),
                            "volume": float(quotes['volume'][i]),
                            "price": float(quotes['close'][i])
                        })

                result = {"history": history_data}
                set_cached_data('history', cache_key, result)
                return result

            except requests.exceptions.RequestException as e:
                last_error = str(e)
                if attempt < max_retries - 1:
                    await asyncio.sleep(retry_delay * (2 ** attempt))
                    continue
                break

        # If all retries failed, return error
        raise HTTPException(
            status_code=503,
            detail=f"Failed to fetch history for '{symbol}'. Service temporarily unavailable."
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching history for {symbol}: {str(e)}"
        )

@app.get("/stock/{symbol}/live")
def get_live_price(symbol: str):
    try:
        # Check rate limiting
        if is_rate_limited('live'):
            raise HTTPException(status_code=429, detail="Too many requests. Please try again later.")
        
        # Check cache with shorter duration
        cached_data = get_cached_data('live', symbol)
        if cached_data:
            return cached_data
        
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
        data = make_api_request(url)
        
        if 'chart' not in data or 'result' not in data['chart'] or not data['chart']['result']:
            raise HTTPException(status_code=404, detail="Live price not available")
            
        result = data['chart']['result'][0]
        meta = result['meta']
        
        live_data = {
            "symbol": symbol,
            "price": meta.get('regularMarketPrice', None),
            "timestamp": datetime.now().isoformat()
        }
        
        # Cache the result
        set_cached_data('live', symbol, live_data)
        return live_data
        
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Error fetching live price: {str(e)}")

@app.get("/stock/{symbol}/news")
async def get_stock_news(symbol: str):
    try:
        # Check rate limiting
        if is_rate_limited('news'):
            # Try to return cached data if available
            cached_data = get_cached_data('news', symbol)
            if cached_data:
                return cached_data
            raise HTTPException(status_code=429, detail="Too many requests. Please try again later.")
        
        # Check cache first
        cached_data = get_cached_data('news', symbol)
        if cached_data:
            return cached_data
        
        url = f"https://query1.finance.yahoo.com/v1/finance/search"
        params = {
            "q": symbol,
            "quotesCount": 0,
            "newsCount": 10,
            "enableFuzzyQuery": False
        }
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        response = requests.get(url, params=params, headers=headers, timeout=5)
        response.raise_for_status()
        data = response.json()
        
        news_items = data.get("news", [])
        
        # Process and format news items
        formatted_news = []
        for item in news_items:
            formatted_news.append({
                "title": item.get("title"),
                "publisher": item.get("publisher"),
                "link": item.get("link"),
                "published_at": item.get("providerPublishTime"),
                "type": item.get("type"),
                "thumbnail": item.get("thumbnail", {}).get("resolutions", [{}])[0].get("url")
            })
        
        result = {"news": formatted_news}
        # Cache the result
        set_cached_data('news', symbol, result)
        return result
        
    except requests.exceptions.RequestException as e:
        print(f"Error fetching news for {symbol}: {str(e)}")
        # Try to return cached data on error
        cached_data = get_cached_data('news', symbol)
        if cached_data:
            return cached_data
        raise HTTPException(status_code=503, detail="Service temporarily unavailable")
    except Exception as e:
        print(f"Error in get_stock_news: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/stock/{symbol}/predict")
async def predict_stock(symbol: str, days: int = 30):
    """Predict stock prices for the next specified number of days."""
    try:
        # Check rate limiting
        if is_rate_limited('history'):
            return {"error": "Rate limit exceeded. Please try again later."}

        # Check cache
        cache_key = f"{symbol}_predict_{days}"
        cached_data = get_cached_data('history', cache_key)
        if cached_data:
            return cached_data

        # Get historical data for training
        stock = yf.Ticker(symbol)
        hist = stock.history(period="1y")
        
        if hist.empty:
            raise HTTPException(status_code=404, detail="No historical data found")

        # Prepare data for prediction
        X = np.arange(len(hist)).reshape(-1, 1)
        y = hist['Close'].values
        
        # Scale the data
        scaler_X = StandardScaler()
        scaler_y = StandardScaler()
        
        X_scaled = scaler_X.fit_transform(X)
        y_scaled = scaler_y.fit_transform(y.reshape(-1, 1)).ravel()

        # Train the model
        model = LinearRegression()
        model.fit(X_scaled, y_scaled)

        # Generate future dates for prediction
        future_dates = [hist.index[-1] + timedelta(days=x) for x in range(1, days + 1)]
        future_X = np.arange(len(hist), len(hist) + days).reshape(-1, 1)
        future_X_scaled = scaler_X.transform(future_X)

        # Make predictions
        predictions_scaled = model.predict(future_X_scaled)
        predictions = scaler_y.inverse_transform(predictions_scaled.reshape(-1, 1)).ravel()

        # Calculate confidence intervals (simple approach)
        std_dev = np.std(hist['Close'].values)
        confidence_interval = 1.96 * std_dev  # 95% confidence interval

        # Prepare response
        prediction_data = {
            "dates": [d.strftime("%Y-%m-%d") for d in future_dates],
            "predictions": predictions.tolist(),
            "upper_bound": (predictions + confidence_interval).tolist(),
            "lower_bound": (predictions - confidence_interval).tolist(),
            "last_actual": float(hist['Close'].iloc[-1]),
            "last_actual_date": hist.index[-1].strftime("%Y-%m-%d")
        }

        # Cache the results
        set_cached_data('history', cache_key, prediction_data)

        return prediction_data

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 