import os
import requests
from datetime import datetime
from hashlib import sha256
from google.cloud import firestore
from flask import Request

db = firestore.Client()

MAILGUN_API_KEY = os.environ.get("MAILGUN_API_KEY")
SANDBOX_DOMAIN = os.environ.get("SANDBOX_DOMAIN")
SECRET_KEY = os.environ.get("SECRET_KEY")

def format_date(iso_str):
    try:
        dt = datetime.strptime(iso_str, "%Y-%m-%dT%H:%M:%SZ")
        return dt.strftime("%d %B %Y, %H:%M")
    except Exception:
        return iso_str

def generate_token(email: str) -> str:
    return sha256((email + SECRET_KEY).encode()).hexdigest()

def check_latest_earthquake(request: Request):
    req_json = request.get_json(silent=True)

    if req_json and "mag" in req_json:
        last_eq = req_json
        print("Using mock data from request")
    else:
        response = requests.get("https://api.orhanaydogdu.com.tr/deprem/kandilli/live")
        if response.status_code != 200:
            return f"API ERROR: {response.status_code}", 500

        data = response.json()
        earthquakes = data.get("result", [])
        if not earthquakes:
            return "No earthquake data found", 404

        last_eq = earthquakes[0]
        print("Fetched data from Kandilli API")

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

    if mag < 0:
        print(f"Filtered out earthquake with magnitude {mag}")
        return "Filtered out earthquake below magnitude threshold", 200

    query = db.collection('earthquakes')\
              .where('place', '==', place)\
              .where('timestamp', '==', timestamp)\
              .limit(1).get()

    if query:
        return "Duplicate earthquake - skipping", 200

    db.collection('earthquakes').add({
        'magnitude': mag,
        'depth': depth,
        'place': place,
        'timestamp': timestamp,
        'latitude': lat,
        'longitude': lon
    })
    
    sent_count = 0

    for doc in db.collection('subscribers').stream():
        email = doc.to_dict().get("email")
        if not email:
            continue

        token = generate_token(email)
        unsubscribe_url = f"https://europe-west1-deprem-460420.cloudfunctions.net/unsubscribeUser?email={email}&token={token}"

        html_content = f"""
        <h2>Earthquake Alert</h2>
        <p><strong>Location:</strong> {place}</p>
        <p><strong>Magnitude:</strong> {mag}</p>
        <p><strong>Depth:</strong> {depth} km</p>
        <p><strong>Date:</strong> {formatted_date}</p>
        <p><a href="{maps_url}">View on Map</a></p>
        <p><a href="{traffic_url}">Check Local Traffic</a></p>
        <hr>
        <p>If you no longer wish to receive alerts, <a href="{unsubscribe_url}">click here to unsubscribe</a>.</p>
        """

        plain_text = (
            f"Earthquake Alert:\n"
            f"Location: {place}\n"
            f"Magnitude: {mag}\n"
            f"Depth: {depth} km\n"
            f"Date: {formatted_date}\n"
            f"Map: {maps_url}\n"
            f"Traffic: {traffic_url}\n\n"
            f"Unsubscribe: {unsubscribe_url}"
        )

        mail_resp = requests.post(
            f"https://api.mailgun.net/v3/{SANDBOX_DOMAIN}/messages",
            auth=("api", MAILGUN_API_KEY),
            data={
                "from": f"Earthquake Alert <mailgun@{SANDBOX_DOMAIN}>",
                "to": email,
                "subject": f"Earthquake Alert: Magnitude {mag}",
                "text": plain_text,
                "html": html_content
            }
        )

        print(f"Sent to {email} → {mail_resp.status_code}")
        sent_count += 1

        doc.reference.update({
            "emails_sent": firestore.Increment(1)
        })

    return f"New earthquake logged and notified to {sent_count} subscriber(s)", 200
