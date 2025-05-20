// Replace 'https://your-backend-url.com' with your actual deployed backend URL
const API_BASE_URL = process.env.NODE_ENV === 'production'
    ? 'https://stock-predict-backend.herokuapp.com'  // Your Heroku app URL
    : 'http://localhost:8000';

export const config = {
    API_BASE_URL,
}; 