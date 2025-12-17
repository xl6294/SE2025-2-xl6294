/*
  ==========================================================
  Environmental Snapshot Logger (Phase 2) — WiFi + POST + LEDs
  ==========================================================
  - Button press -> sample 5 seconds -> stable loudness (trimmed mean)
  - Then POST JSON to Google Apps Script Web App (/exec)
  - created_at is generated server-side (Apps Script)
  - event_id is generated on Nano and persisted in flash

  TRAFFIC LIGHT LEDs:
    RED    = WiFi not connected (or reconnecting)
    YELLOW = sampling window (5s)
    GREEN  = idle + WiFi connected
    GREEN blink = POST succeeded
    RED blink   = POST failed

  SERIAL COMMANDS (type in Serial Monitor, Newline):
    s            -> show current event_id counter
    r            -> reset counter to 0
    set 123      -> set counter to 123
*/

#include <DHT.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <Preferences.h>

/************************************************
 * WIFI / API CONFIG (EDIT THESE)
 ************************************************/
const char* WIFI_SSID = "xxxxxxx";
const char* WIFI_PASS = "xxxxxxxx";

// Use your deployed Web App exec URL:
const char* GAS_EXEC_URL = "https://script.google.com/macros/s/AKfycbwLa5NbJ6YLRNrDEE9hFN6BDxUBrDodTRkSjglc1LPs3emnZVm6YzEJUuIyezBFnEhq/exec";

// If your script ever expects a different header, keep Content-Type JSON.
const int POST_TIMEOUT_MS = 12000;

/************************************************
 * PINS
 ************************************************/
#define DHTPIN   2
#define DHTTYPE  DHT11
DHT dht(DHTPIN, DHTTYPE);

const int MIC_PIN    = A0;
const int BUTTON_PIN = 3;

const int GREEN_LED_PIN  = 4;
const int YELLOW_LED_PIN = 5;
const int RED_LED_PIN    = 6;

/************************************************
 * SAMPLING SETTINGS
 ************************************************/
const int sampleWindowMs = 50;          // one amplitude sample uses ~50ms
const unsigned long CAPTURE_MS = 5000;  // capture duration

const int MAX_AMP_SAMPLES = 140;
unsigned int ampSamples[MAX_AMP_SAMPLES];
int ampCount = 0;

// DHT read throttling (DHT11 is slow)
unsigned long lastDhtReadMs = 0;
const unsigned long DHT_READ_INTERVAL_MS = 1000;

/************************************************
 * BUTTON DEBOUNCE
 ************************************************/
const unsigned long DEBOUNCE_MS = 150;
bool lastButtonReading = HIGH;
bool stableButtonState = HIGH;
unsigned long lastDebounceChange = 0;

/************************************************
 * STATE / RESULTS
 ************************************************/
bool isSampling = false;
unsigned long captureStartMs = 0;

float lastTempC = NAN;
float lastTempF = NAN;
float lastHumidity = NAN;

/************************************************
 * EVENT COUNTER PERSISTENCE
 ************************************************/
Preferences prefs;
const char* PREF_NS = "envlogger";
const char* PREF_KEY_EVENT = "eventCounter";
unsigned long eventCounter = 0;

/************************************************
 * WIFI STATE
 ************************************************/
unsigned long lastWiFiAttemptMs = 0;
const unsigned long WIFI_RETRY_INTERVAL_MS = 8000;

/************************************************
 * LED HELPERS
 ************************************************/
void setAllLeds(bool g, bool y, bool r) {
  digitalWrite(GREEN_LED_PIN,  g ? HIGH : LOW);
  digitalWrite(YELLOW_LED_PIN, y ? HIGH : LOW);
  digitalWrite(RED_LED_PIN,    r ? HIGH : LOW);
}

void setIdleLeds() {
  // Idle: green only if WiFi connected; else red.
  if (WiFi.status() == WL_CONNECTED) setAllLeds(true, false, false);
  else setAllLeds(false, false, true);
}

void setSamplingLeds() {
  // Sampling always yellow (even if WiFi drops)
  setAllLeds(false, true, false);
}

void blinkLed(int pin, int times, int msOn = 120, int msOff = 120) {
  // turn others off for clarity
  if (pin != GREEN_LED_PIN) digitalWrite(GREEN_LED_PIN, LOW);
  if (pin != YELLOW_LED_PIN) digitalWrite(YELLOW_LED_PIN, LOW);
  if (pin != RED_LED_PIN) digitalWrite(RED_LED_PIN, LOW);

  for (int i = 0; i < times; i++) {
    digitalWrite(pin, HIGH);
    delay(msOn);
    digitalWrite(pin, LOW);
    delay(msOff);
  }
}

/************************************************
 * SOUND: read one peak-to-peak amplitude sample
 ************************************************/
unsigned int readSoundPeakToPeak() {
  unsigned long startMillis = millis();
  unsigned int signalMax = 0;
  unsigned int signalMin = 4095;

  while (millis() - startMillis < (unsigned long)sampleWindowMs) {
    unsigned int sample = analogRead(MIC_PIN);
    if (sample <= 4095) {
      if (sample > signalMax) signalMax = sample;
      if (sample < signalMin) signalMin = sample;
    }
  }
  return signalMax - signalMin;
}

/************************************************
 * SOUND: spike loudness (95th percentile)
 * - copies samples to temp
 * - sorts ascending
 * - returns the value at the 95th percentile
 ************************************************/
unsigned int computeTrimmedMean(const unsigned int* arr, int n) {
  if (n <= 0) return 0;
  if (n == 1) return arr[0];

  // Copy (so we can sort)
  static unsigned int temp[MAX_AMP_SAMPLES];
  int m = (n > MAX_AMP_SAMPLES) ? MAX_AMP_SAMPLES : n;
  for (int i = 0; i < m; i++) temp[i] = arr[i];

  // Insertion sort (m ~100)
  for (int i = 1; i < m; i++) {
    unsigned int key = temp[i];
    int j = i - 1;
    while (j >= 0 && temp[j] > key) {
      temp[j + 1] = temp[j];
      j--;
    }
    temp[j + 1] = key;
  }

  // 95th percentile index (clamped)
  int idx = (int)(0.95f * (m - 1));
  if (idx < 0) idx = 0;
  if (idx > m - 1) idx = m - 1;

  return temp[idx];
}

/************************************************
 * WIFI: connect / reconnect
 ************************************************/
void ensureWiFiConnected(bool forceAttempt = false) {
  if (WiFi.status() == WL_CONNECTED) return;

  unsigned long now = millis();
  if (!forceAttempt && (now - lastWiFiAttemptMs) < WIFI_RETRY_INTERVAL_MS) return;

  lastWiFiAttemptMs = now;

  // show red while we try
  setAllLeds(false, false, true);

  Serial.print("WiFi: connecting to ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  // short blocking wait (keeps it simple)
  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - t0) < 6000) {
    delay(200);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("WiFi connected. IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("WiFi not connected yet.");
  }

  setIdleLeds();
}

/************************************************
 * POST one event to Apps Script
 * Returns true if it "likely worked".
 *
 * Why "likely":
 * - Google Apps Script /exec often replies with a redirect (302/303/307/308)
 *   to a googleusercontent URL.
 * - Even when the row is successfully appended, the redirect page can return
 *   HTML (and sometimes a 400) that confuses the ESP32 client.
 *
 * Strategy:
 * - DO NOT follow redirects (we only care that /exec ran).
 * - Treat 200 as success.
 * - Also treat 302/303/307/308 as success (common GAS behavior).
 * - Only print response body when code >= 400 (real error).
 ************************************************/
bool postToAppsScript(unsigned long eventId,
                      float tempC,
                      float humidity,
                      unsigned int soundLoudness) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("POST skipped: WiFi not connected.");
    return false;
  }

  HTTPClient http;

  // Key change: don't follow GAS redirects (prevents confusing 400 HTML)
  http.setFollowRedirects(HTTPC_DISABLE_FOLLOW_REDIRECTS);

  // Optional: timeout (make sure POST_TIMEOUT_MS exists)
  http.setTimeout(POST_TIMEOUT_MS);

  Serial.println("POST: sending to Apps Script...");

  if (!http.begin(GAS_EXEC_URL)) {
    Serial.println("POST failed: http.begin() failed");
    return false;
  }

  http.addHeader("Content-Type", "application/json");

  // Build JSON body (created_at is generated in Apps Script)
  String body = "{";
  body += "\"event_id\":" + String(eventId) + ",";
  body += "\"temp_c\":" + (isnan(tempC) ? String("null") : String(tempC, 1)) + ",";
  body += "\"humidity_pct\":" + (isnan(humidity) ? String("null") : String(humidity, 1)) + ",";
  body += "\"sound_loudness\":" + String(soundLoudness);
  body += "}";

  // Send POST
  int code = http.POST((uint8_t*)body.c_str(), body.length());
  String resp = http.getString();
  http.end();

  Serial.print("HTTP code: ");
  Serial.println(code);

  // Only show body when it's a real error
  if (code >= 400) {
    Serial.print("Response (first 200 chars): ");
    Serial.println(resp.substring(0, 200));
  }

  // Success cases
  if (code == 200) return true;

  // Common GAS redirect responses (still usually indicates /exec ran)
  if (code == 302 || code == 303 || code == 307 || code == 308) return true;

  return false;
}

/************************************************
 * EVENT COUNTER: load/save
 ************************************************/
void loadEventCounter() {
  prefs.begin(PREF_NS, false);
  eventCounter = prefs.getULong(PREF_KEY_EVENT, 0);
  Serial.print("Loaded eventCounter = ");
  Serial.println(eventCounter);
}

void saveEventCounter() {
  prefs.putULong(PREF_KEY_EVENT, eventCounter);
}

/************************************************
 * SERIAL COMMANDS
 ************************************************/
void handleSerialCommands() {
  if (!Serial.available()) return;

  String line = Serial.readStringUntil('\n');
  line.trim();
  if (line.length() == 0) return;

  if (line.equalsIgnoreCase("s")) {
    Serial.print("eventCounter = ");
    Serial.println(eventCounter);
    return;
  }

  if (line.equalsIgnoreCase("r")) {
    eventCounter = 0;
    saveEventCounter();
    Serial.println("eventCounter reset to 0");
    return;
  }

  if (line.startsWith("set ")) {
    String nStr = line.substring(4);
    nStr.trim();
    long n = nStr.toInt();
    if (n < 0) n = 0;
    eventCounter = (unsigned long)n;
    saveEventCounter();
    Serial.print("eventCounter set to ");
    Serial.println(eventCounter);
    return;
  }

  Serial.println("Unknown command. Use: s | r | set N");
}

/************************************************
 * SETUP
 ************************************************/
void setup() {
  Serial.begin(9600);
  delay(500);

  dht.begin();
  analogReadResolution(12);

  pinMode(MIC_PIN, INPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  pinMode(GREEN_LED_PIN, OUTPUT);
  pinMode(YELLOW_LED_PIN, OUTPUT);
  pinMode(RED_LED_PIN, OUTPUT);

  // Start with red until WiFi is confirmed
  setAllLeds(false, false, true);

  loadEventCounter();

  Serial.println("=== Environmental Snapshot Logger (Phase 2) ===");
  Serial.println("Button press -> sample 5s -> POST to Apps Script");
  Serial.println("Commands: s | r | set N");
  Serial.println();

  ensureWiFiConnected(true);
  setIdleLeds();
}

/************************************************
 * LOOP
 ************************************************/
void loop() {
  handleSerialCommands();

  // keep WiFi alive (but don't spam attempts)
  ensureWiFiConnected(false);

  handleButton();

  if (isSampling) {
    runSamplingLoop();
  } else {
    // idle LED reflects WiFi state
    setIdleLeds();
  }
}

/************************************************
 * BUTTON (debounced) -> start capture on press
 ************************************************/
void handleButton() {
  bool reading = digitalRead(BUTTON_PIN);
  unsigned long now = millis();

  if (reading != lastButtonReading) {
    lastDebounceChange = now;
    lastButtonReading = reading;
  }

  if ((now - lastDebounceChange) > DEBOUNCE_MS) {
    if (reading != stableButtonState) {
      stableButtonState = reading;
      if (stableButtonState == LOW) { // pressed
        startCapture();
      }
    }
  }
}

/************************************************
 * START / RUN / FINISH CAPTURE
 ************************************************/
void startCapture() {
  if (isSampling) return;

  isSampling = true;
  captureStartMs = millis();

  ampCount = 0;
  lastDhtReadMs = 0;

  lastTempC = NAN;
  lastTempF = NAN;
  lastHumidity = NAN;

  setSamplingLeds();
  Serial.println("---- Sampling started (5s) ----");
}

void runSamplingLoop() {
  unsigned long now = millis();

  // 1) Sound amplitude sample
  unsigned int amp = readSoundPeakToPeak();
  if (ampCount < MAX_AMP_SAMPLES) {
    ampSamples[ampCount++] = amp;
  }

  // 2) DHT reads (throttled)
  if (lastDhtReadMs == 0 || (now - lastDhtReadMs) >= DHT_READ_INTERVAL_MS) {
    lastDhtReadMs = now;

    float h = dht.readHumidity();
    float tC = dht.readTemperature(false);

    if (!isnan(h) && !isnan(tC)) {
      lastHumidity = h;
      lastTempC = tC;
      lastTempF = (tC * 9.0 / 5.0) + 32.0;
    }
  }

  // 3) End after 5 seconds
  if ((now - captureStartMs) >= CAPTURE_MS) {
    finishCapture();
  }
}

void finishCapture() {
  isSampling = false;

  // Next event_id (persisted)
  eventCounter++;
  saveEventCounter();

  // Stable loudness result
  unsigned int loudnessStable = computeTrimmedMean(ampSamples, ampCount);

  // Print local summary (always)
  Serial.print("{\"event_id\":");
  Serial.print(eventCounter);

  Serial.print(",\"sound_loudness\":");
  Serial.print(loudnessStable);

  Serial.print(",\"sound_samples\":");
  Serial.print(ampCount);

  Serial.print(",\"temp_c\":");
  if (isnan(lastTempC)) Serial.print("null"); else Serial.print(lastTempC, 1);

  Serial.print(",\"humidity_pct\":");
  if (isnan(lastHumidity)) Serial.print("null"); else Serial.print(lastHumidity, 1);

  Serial.println("}");

  // Try POST
  bool ok = postToAppsScript(eventCounter, lastTempC, lastHumidity, loudnessStable);

  if (ok) {
    Serial.println("✅ POST likely succeeded.");
    blinkLed(GREEN_LED_PIN, 4);
  } else {
    Serial.println("⚠ POST failed.");
    blinkLed(RED_LED_PIN, 4);
  }

  setIdleLeds();
  Serial.println("---- Sampling finished ----");
  Serial.println();
}