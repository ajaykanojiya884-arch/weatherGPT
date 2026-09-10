# AI Outdoor & Travel Chatbot

## Feature Overview

WeatherGPT AI now includes an integrated AI Outdoor & Travel Advisor inside the existing WeatherGPT conversation and dashboard. It is not a standalone widget or separate application. Users can ask natural-language questions about outdoor activities, destinations, trips, road travel, departure timing, family plans, and weather risks.

Examples:

- Can I go outside today?
- Can I travel to Jaipur tomorrow?
- Should I go from Mumbai to Pune by road?
- Is it safe to drive to Rajasthan tomorrow?
- Can I go hiking?
- Can I take my family for an outdoor trip?
- Should I leave in the morning or evening?
- Is my destination suitable for travel?

The advisor resolves the destination, detects the date and intent, retrieves real forecast and air-quality data, computes a transparent recommendation, and returns dynamic follow-up actions.

## User Flow

```text
User asks a natural-language question
        |
        v
WeatherGPT Advisor receives current selected location and conversation context
        |
        v
outdoorTravelService detects destination, date, activity, mode, and intent
        |
        v
Real geocoding resolves the destination coordinates
        |
        v
Open-Meteo forecast and air-quality data are retrieved
        |
        v
Outdoor/travel decision engine computes risk, score, recommendation, and departure window
        |
        v
WeatherGPT renders a professional response card and dynamic follow-up actions
```

## Files

### `lib/outdoorTravelService.js`

The modular decision service. It contains:

- Natural-language intent detection.
- Destination and route extraction.
- Date detection for today, tomorrow, and this weekend.
- Activity profiles.
- Real destination resolution with Nominatim.
- Open-Meteo forecast retrieval.
- Open-Meteo air-quality retrieval.
- Outdoor risk scoring.
- Travel scoring.
- Best and avoid departure-window calculation.
- Route endpoint analysis.
- Honest road/highway data limitations.
- Dynamic follow-up suggestion generation.

### `app/api/outdoor-travel/route.js`

The App Router `POST` endpoint:

```text
POST /api/outdoor-travel
```

Request example:

```json
{
  "message": "Can I travel to Jaipur tomorrow?",
  "selectedLocation": {
    "name": "Mumbai",
    "state": "Maharashtra",
    "country": "India",
    "countryCode": "IN",
    "latitude": 19.07283,
    "longitude": 72.88261,
    "locationType": "city"
  },
  "conversation": []
}
```

The selected location is optional when the question contains a destination. It is required for questions such as `Can I go outside today?`, because the advisor needs a current-location context.

### `components/WeatherApp.js`

The existing WeatherGPT client now includes:

- Integrated advisor conversation thread.
- User message history.
- Assistant result cards.
- Loading state while analysis runs.
- Error state through the existing error surface.
- Dynamic clickable follow-up actions.
- Exact selected-location context passed to the backend.

### `app/globals.css`

Adds matching styles for:

- Advisor chat.
- User and assistant messages.
- Recommendation pills.
- Travel metric cards.
- Route status segments.
- Departure window cards.
- Travel score.
- Dynamic action chips.
- Responsive mobile layouts.
- Dashboard travel readiness rail.
- Seven-day rain graph.
- Alert center.

## Supported Activities

The decision engine contains distinct profiles for:

- Walking
- Running
- Cycling
- Hiking
- Picnic
- Camping
- Beach
- Swimming
- Photography
- Fishing
- Golf
- Outdoor sports
- Outdoor events
- Dog walking
- Road trips

Every profile has different rain, wind, and temperature thresholds. The system also considers visibility, thunderstorms, heavy precipitation, AQI, and temperature extremes.

## Intent Detection

The service identifies these intents:

### Outdoor

Triggers include:

- outside
- walking
- running
- hiking
- picnic
- family outing
- children playing
- dog walking

### Travel

Triggers include:

- travel
- trip
- destination
- visit
- go to

### Road Travel

Triggers include:

- drive
- road
- highway
- by car
- by road
- from one place to another

## Destination Resolution

Destinations are resolved through a real geocoding request to Nominatim. The returned entity includes:

- Name
- State
- Country
- Country code
- Latitude
- Longitude
- Location type

The weather source of truth is always the resolved latitude and longitude. The system does not silently replace a selected destination with a fuzzy result.

Example:

```text
Can I travel to Jaipur tomorrow?
```

The service resolves Jaipur, Rajasthan, India and uses Jaipur coordinates for the forecast request.

## Weather Data

The advisor retrieves real data from Open-Meteo:

- Current temperature.
- Apparent temperature.
- Rain probability.
- Weather code.
- Wind speed.
- Visibility.
- Hourly forecast.
- Daily forecast.
- Sunrise and sunset.

Air quality comes from the Open-Meteo Air Quality API:

- US AQI.
- PM2.5.
- PM10.

If a provider does not return a field, the response displays `Unavailable` rather than inventing a value.

## Recommendation Levels

The advisor returns one of four recommendations:

```text
🟢 GOOD TO GO
🟡 GO WITH CAUTION
🟠 NOT IDEAL
🔴 NOT RECOMMENDED
```

Severe thunderstorm weather codes always force `NOT RECOMMENDED`, regardless of the normal score. This prevents a favorable average score from overriding a severe condition.

The recommendation is decision support, not a guarantee of safety.

## Travel Score

The score is calculated from retrieved data and starts at 100. It is reduced for:

- High rain probability.
- Strong winds.
- Reduced visibility.
- Thunderstorms or lightning risk.
- Heavy rain or snow.
- Temperature outside the activity profile.
- High AQI.

The response explains the factors that affected the score. Essential unavailable data is not replaced by fake numbers.

## Outdoor Decision Example

For:

```text
Can I go outside today?
```

The advisor returns:

- Selected/current location.
- Activity profile.
- Current or target-date weather.
- Outdoor recommendation.
- Reasons based on live forecast data.
- Best available time window.
- Risk considerations.
- Dynamic follow-up actions.

It never returns only a yes/no answer.

## Road and Highway Intelligence

For a road question, the response includes:

```text
🚗 ROAD TRAVEL INTELLIGENCE
```

It analyzes verified endpoint weather when origin and destination are available. It does not claim to know live road conditions unless a connected road-data provider supplies them.

The current response explicitly states:

```text
Live highway-condition information is not currently available from the connected data sources.
```

For a route such as Ahmedabad to Jaipur, the service returns:

- Resolved Ahmedabad endpoint.
- Resolved Jaipur endpoint.
- Endpoint weather-based statuses.
- Route limitation notice.
- No fabricated traffic, flood, closure, or highway condition claims.

Intermediate route-segment weather is clearly marked unavailable because a route geometry and segment weather provider are not currently connected.

## Departure Time

The service scans the available hourly forecast and returns:

```text
⏰ BEST DEPARTURE WINDOW
```

It compares daytime hourly conditions and selects the highest-scoring available window. It also returns:

```text
⚠️ AVOID
```

The explanation is based on the real forecast signals available for that destination and date, such as rain probability, visibility, wind, temperature, and storms.

## Conversation Context

The client stores assistant results with a structured context object. Follow-up questions do not require the user to repeat the destination.

Example:

```text
User: Can I travel to Jaipur tomorrow?
Assistant: Jaipur analysis
User: By road?
Assistant: Jaipur road-travel analysis
User: What time should I leave?
Assistant: Jaipur departure-window analysis
```

The service reads both direct context and the client assistant-result envelope, so follow-ups retain:

- Destination.
- Origin.
- Date.
- Intent.
- Activity.

## Dynamic Follow-up Actions

Every advisor result can include context-aware actions such as:

```json
{
  "suggestions": [
    {
      "label": "Check weather along route",
      "query": "Check weather along the route"
    },
    {
      "label": "Best departure time",
      "query": "What time should I leave?"
    },
    {
      "label": "Show road limitations",
      "query": "What highway information is verified?"
    }
  ]
}
```

Outdoor, destination, and road questions receive different actions. The UI renders them as clickable chips below the response.

## Dashboard Integration

The feature is integrated into the existing home dashboard with three supporting panels:

### Travel Readiness

Shows the current weather-derived risk level and score. It warns users that official local guidance remains authoritative.

### Seven-Day Rain Outlook

Displays a real graph using daily precipitation probability values from the current weather response.

### Alert Center

Shows weather-derived severe indicators and clearly states that an official alert feed is not currently connected.

This avoids presenting a false official-warning claim while still surfacing relevant computed risk.

## Safety and Honesty Rules

The advisor does not guarantee:

- Travel safety.
- Road safety.
- Weather certainty.
- Highway conditions.
- Official emergency status.

It uses language such as:

```text
Based on the latest available weather and air-quality data...
```

When a data source is unavailable, the response says so explicitly. It never fills missing highway, traffic, or official-alert data with assumptions.

## Validation Completed

Production build:

```text
npm run build
```

Result: successful.

Production server:

```text
npm run start
```

Verified:

- `/` returns HTTP `200`.
- WeatherGPT UI includes the integrated advisor.
- `POST /api/outdoor-travel` resolves Jaipur.
- `Can I go outside today?` works with selected Mumbai context.
- `Can I travel to Jaipur tomorrow?` returns destination, date, score, metrics, and actions.
- Follow-up `By road?` retains Jaipur and switches to road-travel intent.
- Ahmedabad to Jaipur returns endpoint weather plus the explicit highway-data limitation.
- Dynamic suggestions are returned for every tested advisor response.

## Current Connected-Data Limitations

The current implementation does not claim to have:

- Live traffic data.
- Highway closures.
- Flooded-road reports.
- Verified road-surface conditions.
- A government alert feed.
- Complete weather along every intermediate route segment.

Those integrations can be added later through verified providers without changing the advisor contract.

## Next Production Enhancements

Recommended next steps:

1. Add a routing provider for route geometry and major route segments.
2. Add a verified traffic/highway provider.
3. Add official government alert feeds by country or region.
4. Add forecast confidence from provider ensemble or historical error data.
5. Add AQI health categories and sensitive-group guidance.
6. Add automated API tests for all intent and activity profiles.
7. Add browser end-to-end tests for keyboard, mobile, and dynamic follow-ups.
8. Add rate limiting and request tracing to external geocoding and weather calls.
9. Add persistent authenticated chat history for cross-device context.

## Interview Summary

The feature demonstrates a complete AI weather decision workflow:

- Natural-language input.
- Structured intent extraction.
- Exact destination resolution.
- Real forecast retrieval.
- Real AQI retrieval.
- Activity-specific risk analysis.
- Transparent scoring.
- Route-aware limitations.
- Conversation memory.
- Dynamic action generation.
- Responsive dashboard integration.
- Honest handling of unavailable information.

The core product principle is simple:

> WeatherGPT should not merely tell users what the weather is. It should help them decide what to do, while clearly separating verified data from unavailable information and recommendations.
