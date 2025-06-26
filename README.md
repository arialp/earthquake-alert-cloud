# Real-Time Earthquake Alert and Subscription System

## Project Description
This project implements a comprehensive serverless earthquake alert system that fetches real-time earthquake data from Kandilli Observatory, processes it, and sends notifications to subscribed users via email. The system includes a public subscription interface, admin dashboard, and automated data processing pipeline.

### Key Features
- **Real-time Data Processing**: Fetches earthquake data from Kandilli Observatory API every minute
- **User Subscription System**: Web interface for users to subscribe/unsubscribe from alerts
- **Admin Dashboard**: Analytics and subscriber management interface
- **Email Notifications**: Automated alerts sent via Mailgun with map links and traffic information
- **Data Storage**: All earthquake events and subscriber data stored in Firestore
- **Duplicate Prevention**: Smart filtering to avoid sending duplicate alerts

## Architecture

### Backend Services
- **Firebase Cloud Functions**: Serverless functions for API endpoints and data processing
- **Firebase Firestore**: NoSQL database for earthquakes and subscriber data
- **Firebase Hosting**: Static web hosting for subscription and admin interfaces
- **Mailgun API**: Email delivery service for alerts
- **Kandilli Observatory API**: Real-time earthquake data source

### Frontend Components
- **Subscription Page**: Modern responsive interface for email signup
- **Admin Dashboard**: Analytics dashboard with subscriber management and email statistics
- **Unsubscribe Pages**: Automated unsubscribe handling with token verification

## Project Structure

```
├── functions/
│   ├── index.js              # Firebase Cloud Functions (subscribeUser, unsubscribeUser, getSubscribers, getMailgunStats)
│   ├── package.json          # Node.js dependencies
│   └── .eslintrc.js         # ESLint configuration
├── public/
│   ├── index.html           # Subscription page
│   ├── admin/
│   │   └── index.html       # Admin dashboard
│   └── 404.html            # 404 error page
├── earthquakealertfunction.py  # Python Cloud Function for earthquake processing
└── README.md
```

## Setup Instructions

### Prerequisites
1. Firebase CLI installed: `npm install -g firebase-tools`
2. Google Cloud SDK installed
3. Mailgun account with API key

### Firebase Configuration
1. Create a new Firebase project at [Firebase Console](https://console.firebase.google.com)
2. Enable the following services:
   - Cloud Functions
   - Firestore Database
   - Hosting

3. Initialize Firebase in your project:
```bash
firebase login
firebase init

# Select:
# - Functions (JavaScript)
# - Firestore
# - Hosting
```

### Environment Variables
Set the following environment variables for your Cloud Functions:

```bash
firebase functions:config:set mailgun.api_key="your-mailgun-api-key"
firebase functions:config:set mailgun.sandbox_domain="your-sandbox-domain"
firebase functions:config:set app.secret_key="your-secret-key-for-tokens"
```

### Deployment

#### Deploy Firebase Functions and Hosting
```bash
# Deploy everything
firebase deploy

# Or deploy individually
firebase deploy --only functions
firebase deploy --only hosting
```

#### Deploy Python Earthquake Processing Function
```bash
gcloud functions deploy check_latest_earthquake \
  --gen2 \
  --runtime python310 \
  --region europe-west1 \
  --source=. \
  --entry-point check_latest_earthquake \
  --trigger-http \
  --allow-unauthenticated \
  --set-env-vars MAILGUN_API_KEY="your-api-key",SANDBOX_DOMAIN="your-sandbox-domain",SECRET_KEY="your-secret-key"
```

#### Set up Cloud Scheduler (Optional - for automated triggers)
```bash
gcloud scheduler jobs create http earthquake-check \
  --schedule="*/1 * * * *" \
  --uri="https://europe-west1-your-project.cloudfunctions.net/check_latest_earthquake" \
  --http-method=GET \
  --location=europe-west1
```

## API Endpoints

### User Subscription Management
- **POST** `/subscribeUser` - Subscribe email to earthquake alerts
- **GET** `/unsubscribeUser?email=X&token=Y` - Unsubscribe with verification token

### Admin Functions
- **GET** `/getSubscribers` - Get all subscribers (admin)
- **GET** `/getMailgunStats` - Get email delivery statistics

### Data Processing
- **GET/POST** `/check_latest_earthquake` - Process earthquake data (Python function)

## Web Interfaces

### Subscription Page (`/index.html`)
- Modern, responsive design with glassmorphism effects
- Email validation and subscription status feedback
- Success/error messaging with loading states

### Admin Dashboard (`/admin/index.html`)
- Real-time subscriber statistics
- Email campaign analytics with Chart.js visualizations
- Subscriber management (view, search, export)
- Mailgun delivery statistics integration

## Data Flow

1. **Data Ingestion**: Cloud Scheduler triggers earthquake data fetch every minute
2. **Processing**: Python function validates, filters (magnitude > 0), and checks for duplicates
3. **Storage**: New earthquakes stored in Firestore with coordinates and metadata
4. **Notification**: Automated emails sent to all subscribers via Mailgun
5. **Analytics**: Email delivery stats tracked and displayed in admin dashboard

## Email Features

- **HTML and Plain Text**: Dual format emails for compatibility
- **Interactive Maps**: Google Maps links with earthquake coordinates
- **Traffic Information**: Local traffic links for affected areas
- **One-Click Unsubscribe**: Secure token-based unsubscribe links
- **Delivery Tracking**: Open rates and delivery statistics via Mailgun

## Database Schema

### Firestore Collections

#### `subscribers`
```javascript
{
  email: "user@example.com",
  timestamp: 1640995200000,
  emails_sent: 5
}
```

#### `earthquakes`
```javascript
{
  magnitude: 5.3,
  depth: 7.2,
  place: "AYDIN (NAZILLI)",
  timestamp: "2025-01-15T14:30:00Z",
  latitude: 37.9151,
  longitude: 28.3210
}
```

## Testing

### Manual Testing with Mock Data
Send POST request to `/check_latest_earthquake` with:
```json
{
  "mag": "5.3",
  "depth": "7.2", 
  "title": "AYDIN (NAZILLI)",
  "date": "2025-01-15T14:30:00Z",
  "geojson": {
    "coordinates": [28.3210, 37.9151]
  }
}
```

### Local Development
```bash
# Run Firebase emulators
firebase emulators:start

# Test functions locally
firebase functions:shell
```

## Team

| Name              | Student ID     |
|-------------------|----------------|
| Alp Eren Arı      | 212010020039   |
| Yılmaz Büyük      | 212010020077   |
| Bekir Eren Ünüvar | 202010020072   |

## License

This project is developed for educational purposes as part of a cloud computing course.
