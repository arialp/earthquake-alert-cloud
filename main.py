import os
import requests
from datetime import datetime
from google.cloud import firestore
from flask import Request

db = firestore.Client()

MAILGUN_API_KEY = os.environ.get("MAILGUN_API_KEY")
TO_EMAIL = os.environ.get("ALERT_EMAIL")
SANDBOX_DOMAIN = os.environ.get("SANDBOX_DOMAIN")

def format_date(iso_str):
    try:
        dt = datetime.strptime(iso_str, "%Y-%m-%dT%H:%M:%SZ")
        return dt.strftime("%d %B %Y, %H:%M")
    except Exception:
        return iso_str

def check_latest_earthquake(request: Request):
    # Accept mock data from request if present
    req_json = request.get_json(silent=True)

    if req_json and "mag" in req_json:
        last_eq = req_json
        print("Using mock data from request")
    else:
        # Fetch data from Kandilli API
        response = requests.get("https://api.orhanaydogdu.com.tr/deprem/kandilli/live")
        if response.status_code != 200:
            return f"API ERROR: {response.status_code}", 500

        data = response.json()
        earthquakes = data.get("result", [])
        if not earthquakes:
            return "No earthquake data found", 404

        last_eq = earthquakes[0]
        print("Fetched data from Kandilli API")

    # Check required fields
    if not all(k in last_eq for k in ["mag", "title", "date", "depth", "geojson"]):
        return "Invalid earthquake data structure", 400

    try:
        mag = float(last_eq['mag'])
    except (ValueError, TypeError):
        return "Invalid magnitude value", 400

    try:
        depth = float(last_eq['depth'])
    except (ValueError, TypeError):
        depth = "Unknown"

    place = str(last_eq.get('title', 'Unknown Location'))
    timestamp = last_eq.get('date')
    if not timestamp:
        return "Missing timestamp", 400
    formatted_date = format_date(timestamp)

    coords = last_eq.get("geojson", {}).get("coordinates", [])
    if isinstance(coords, list) and len(coords) == 2:
        try:
            lon = float(coords[0])
            lat = float(coords[1])
            maps_url = f"https://www.google.com/maps?q={lat},{lon}"
            traffic_url = f"https://www.google.com/maps/@{lat},{lon},14z/data=!5m1!1e1"
        except (ValueError, TypeError):
            lat = lon = None
            maps_url = traffic_url = "https://www.google.com/maps"
    else:
        lat = lon = None
        maps_url = traffic_url = "https://www.google.com/maps"

    # Filter earthquakes below 0 magnitude (new rule)
    if mag < 0:
        print(f"Filtered out earthquake with magnitude {mag}")
        return "Filtered out earthquake below magnitude threshold", 200

    # Check if earthquake already recorded
    query = db.collection('earthquakes')\
              .where('place', '==', place)\
              .where('timestamp', '==', timestamp)\
              .limit(1).get()

    if query:
        return "Duplicate earthquake - skipping", 200

    # Save new earthquake and send email
    db.collection('earthquakes').add({
        'magnitude': mag,
        'depth': depth,
        'place': place,
        'timestamp': timestamp,
        'latitude': lat,
        'longitude': lon
    })

    html_content = f"""
    <h2>Earthquake Alert</h2>
    <p><strong>Location:</strong> {place}</p>
    <p><strong>Magnitude:</strong> {mag}</p>
    <p><strong>Depth:</strong> {depth} km</p>
    <p><strong>Date:</strong> {formatted_date}</p>
    <p><a href="{maps_url}">View on Map</a></p>
    <p><a href="{traffic_url}">Check Local Traffic</a></p>
    """

    plain_text = (
        f"Earthquake Alert:\n"
        f"Location: {place}\n"
        f"Magnitude: {mag}\n"
        f"Depth: {depth} km\n"
        f"Date: {formatted_date}\n"
        f"Map: {maps_url}\n"
        f"Traffic: {traffic_url}"
    )

    mail_resp = requests.post(
        f"https://api.mailgun.net/v3/{SANDBOX_DOMAIN}/messages",
        auth=("api", MAILGUN_API_KEY),
        data={
            "from": f"Earthquake Alert <mailgun@{SANDBOX_DOMAIN}>",
            "to": TO_EMAIL,
            "subject": f"Earthquake Alert: Magnitude {mag}",
            "text": plain_text,
            "html": html_content
        }
    )

    print(f"Mailgun response: {mail_resp.status_code} - {mail_resp.text}")
    return f"New earthquake logged and notified: {place}", 200
