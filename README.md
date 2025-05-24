# Real-Time Earthquake Alert and Logging System (Serverless Data Processing Pipeline)

## Project Description

This project implements a serverless pipeline that fetches real-time earthquake data from Kandilli Observatory, filters and processes it, and sends notifications via email if the earthquake is new. All qualified events are also logged in Firestore.

Key functions include:

- Pulling data from a public earthquake API every minute
- Parsing and validating earthquake metadata
- Filtering out events below a magnitude threshold (<0)
- Avoiding duplicates by checking the database
- Sending alert emails with location and traffic map links
- Storing processed events in Firestore with coordinates and depth

## Architecture

- **Cloud Scheduler**: Triggers function every 1 minute
- **Cloud Function**: Processes the data
- **Firestore**: Stores earthquake data
- **Mailgun**: Sends email notifications
- **Google Maps URLs**: Included in emails for context

## Features

- Fully serverless design
- Real-time data retrieval and filtering
- Duplicate check and smart database insert
- Formatted HTML and plain text email alerts
- Map and traffic links generated from coordinates
- Optional mock data input for manual testing

## Setup

1. Enable the following GCP services:
   - Cloud Functions
   - Firestore
   - Cloud Scheduler
2. Create a Mailgun account and get your API key
3. Set the following environment variables:
   - `MAILGUN_API_KEY`
   - `ALERT_EMAIL`
   - `SANDBOX_DOMAIN`
4. Deploy the function using:

```bash
gcloud functions deploy check_latest_earthquake \
  --gen2 \
  --runtime python310 \
  --region europe-west1 \
  --source=. \
  --entry-point check_latest_earthquake \
  --trigger-http \
  --allow-unauthenticated \
  --set-env-vars MAILGUN_API_KEY=your-api-key,ALERT_EMAIL=your-email@example.com,SANDBOX_DOMAIN=sandboxXXX.mailgun.org
```

## Usage

- Automatically triggered via Cloud Scheduler
- You can also send mock earthquake data via HTTP POST

### Example Mock Payload

```json
{
  "mag": "5.3",
  "depth": "7.2",
  "title": "AYDIN (NAZILLI)",
  "date": "2025-05-21T14:00:00Z",
  "geojson": {
    "coordinates": [28.3210, 37.9151]
  }
}
```

## Pipeline Stages Covered

- Data ingestion
- Parsing and transformation
- Filtering (magnitude check)
- Duplicate detection
- Data persistence
- Email generation and delivery

## Team

| Name              | Student ID     |
|-------------------|----------------|
| Alp Eren Arı      | 212010020039   |
| Yılmaz Büyük      | 212010020077   |
| Bekir Eren Ünüvar | 202010020072   |
