/*
 * WiFiSense 3D - ESP32 Firmware
 * ==============================
 * Scans nearby Wi-Fi access points and reports RSSI readings
 * via a JSON Lines serial protocol.
 *
 * Communication: 115200 baud, JSON Lines over USB serial
 * Mode: Wi-Fi STA scan-only (no association required)
 *
 * Required library: ArduinoJson (v7.x) - install via Arduino Library Manager
 * Board: ESP32 Dev Module (or compatible)
 *
 * Serial Protocol:
 *   Commands (laptop -> ESP32):
 *     {"command":"PING"}
 *     {"command":"SCAN"}
 *     {"command":"START","count":10,"interval_ms":5000,"ssid":"MyWiFi","bssid":"","x_m":1.0,"y_m":2.0,"z_m":1.0}
 *     {"command":"STOP"}
 *     {"command":"STATUS"}
 *     {"command":"SET_NODE","node_id":"ESP32_01"}
 *
 *   Responses (ESP32 -> laptop):
 *     {"type":"ready","firmware":"WiFiSense3D","version":"1.0.0","node_id":"ESP32_01"}
 *     {"type":"pong","uptime_ms":12345,"node_id":"ESP32_01"}
 *     {"type":"scan_result","networks":[...],"count":N}
 *     {"type":"measurement","sample_index":1,...}
 *     {"type":"batch_complete","total_samples":10,"valid_samples":9}
 *     {"type":"status","state":"idle"|"measuring","..."}
 *     {"type":"error","code":"...","message":"..."}
 */

#include <WiFi.h>
#include <ArduinoJson.h>

// ─── Configuration ───────────────────────────────────────────────
#define SERIAL_BAUD       115200
#define MAX_CMD_LENGTH    512
#define FIRMWARE_NAME     "WiFiSense3D"
#define FIRMWARE_VERSION  "1.0.0"
#define DEFAULT_COUNT     10
#define DEFAULT_INTERVAL  5000
#define MAX_COUNT         100
#define MAX_INTERVAL      60000
#define MIN_INTERVAL      1000

// ─── State ───────────────────────────────────────────────────────
enum DeviceState {
  STATE_IDLE,
  STATE_MEASURING,
  STATE_SCANNING
};

DeviceState currentState = STATE_IDLE;

// Serial command buffer
char cmdBuffer[MAX_CMD_LENGTH];
int cmdIndex = 0;

// Node identity
char nodeId[32] = "ESP32_01";

// Measurement parameters
char targetSSID[64] = "";
char targetBSSID[20] = "";
int   batchCount    = DEFAULT_COUNT;
int   intervalMs    = DEFAULT_INTERVAL;
float coordX        = 0.0;
float coordY        = 0.0;
float coordZ        = 1.0;  // default measurement height 1m

// Measurement tracking
int   currentSample  = 0;
int   validSamples   = 0;
unsigned long lastSampleTime = 0;
unsigned long measurementId  = 0;
bool  stopRequested  = false;

// ─── Setup ───────────────────────────────────────────────────────
void setup() {
  Serial.begin(SERIAL_BAUD);
  delay(500);  // Allow serial to stabilize

  // Initialize WiFi in STA mode for scanning (no connection needed)
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();  // Ensure not connected
  delay(100);

  // Send ready message
  sendReady();
}

// ─── Main Loop ───────────────────────────────────────────────────
void loop() {
  // Always check for incoming serial commands
  readSerialCommands();

  // If measuring, handle the measurement cycle
  if (currentState == STATE_MEASURING) {
    handleMeasurement();
  }
}

// ─── Serial Command Reading ─────────────────────────────────────
void readSerialCommands() {
  while (Serial.available()) {
    char c = Serial.read();

    if (c == '\n' || c == '\r') {
      if (cmdIndex > 0) {
        cmdBuffer[cmdIndex] = '\0';
        processCommand(cmdBuffer);
        cmdIndex = 0;
      }
    } else {
      if (cmdIndex < MAX_CMD_LENGTH - 1) {
        cmdBuffer[cmdIndex++] = c;
      } else {
        // Buffer overflow - discard and send error
        cmdIndex = 0;
        sendError("BUFFER_OVERFLOW", "Command too long, max 512 chars");
      }
    }
  }
}

// ─── Command Processing ─────────────────────────────────────────
void processCommand(const char* cmd) {
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, cmd);

  if (err) {
    sendError("PARSE_ERROR", String("JSON parse failed: ") + err.c_str());
    return;
  }

  const char* command = doc["command"] | "";

  if (strcmp(command, "PING") == 0) {
    handlePing();
  }
  else if (strcmp(command, "SCAN") == 0) {
    handleScan();
  }
  else if (strcmp(command, "START") == 0) {
    handleStart(doc);
  }
  else if (strcmp(command, "STOP") == 0) {
    handleStop();
  }
  else if (strcmp(command, "STATUS") == 0) {
    handleStatus();
  }
  else if (strcmp(command, "SET_NODE") == 0) {
    const char* nid = doc["node_id"] | "";
    if (strlen(nid) > 0 && strlen(nid) < sizeof(nodeId)) {
      strncpy(nodeId, nid, sizeof(nodeId) - 1);
      nodeId[sizeof(nodeId) - 1] = '\0';

      JsonDocument resp;
      resp["type"] = "node_set";
      resp["node_id"] = nodeId;
      sendJson(resp);
    } else {
      sendError("INVALID_NODE", "node_id must be 1-31 characters");
    }
  }
  else {
    sendError("UNKNOWN_CMD", String("Unknown command: ") + command);
  }
}

// ─── Command Handlers ───────────────────────────────────────────

void handlePing() {
  JsonDocument doc;
  doc["type"]      = "pong";
  doc["uptime_ms"] = millis();
  doc["node_id"]   = nodeId;
  doc["state"]     = stateToString(currentState);
  sendJson(doc);
}

void handleScan() {
  if (currentState == STATE_MEASURING) {
    sendError("BUSY", "Cannot scan while measurement in progress");
    return;
  }

  currentState = STATE_SCANNING;

  JsonDocument startDoc;
  startDoc["type"]    = "scan_start";
  startDoc["node_id"] = nodeId;
  sendJson(startDoc);

  int n = WiFi.scanNetworks();

  JsonDocument doc;
  doc["type"]    = "scan_result";
  doc["node_id"] = nodeId;
  doc["count"]   = n;

  if (n < 0) {
    doc["scan_error"] = "WiFi scan failed";
    sendJson(doc);
    currentState = STATE_IDLE;
    return;
  }

  JsonArray networks = doc["networks"].to<JsonArray>();
  for (int i = 0; i < n && i < 20; i++) {  // Limit to 20 for memory
    JsonObject net = networks.add<JsonObject>();
    net["ssid"]    = WiFi.SSID(i);
    net["bssid"]   = WiFi.BSSIDstr(i);
    net["rssi"]    = WiFi.RSSI(i);
    net["channel"] = WiFi.channel(i);
    net["enc"]     = WiFi.encryptionType(i);
  }

  WiFi.scanDelete();
  sendJson(doc);
  currentState = STATE_IDLE;
}

void handleStart(JsonDocument& cmd) {
  if (currentState == STATE_MEASURING) {
    sendError("BUSY", "Measurement already in progress. Send STOP first.");
    return;
  }

  // Parse parameters with defaults
  batchCount  = cmd["count"]       | DEFAULT_COUNT;
  intervalMs  = cmd["interval_ms"] | DEFAULT_INTERVAL;
  coordX      = cmd["x_m"]        | 0.0f;
  coordY      = cmd["y_m"]        | 0.0f;
  coordZ      = cmd["z_m"]        | 1.0f;

  const char* ssid  = cmd["ssid"]  | "";
  const char* bssid = cmd["bssid"] | "";

  // Validate
  if (strlen(ssid) == 0) {
    sendError("MISSING_SSID", "Target SSID is required");
    return;
  }
  if (batchCount < 1 || batchCount > MAX_COUNT) {
    sendError("INVALID_COUNT", String("Count must be 1-") + MAX_COUNT);
    return;
  }
  if (intervalMs < MIN_INTERVAL || intervalMs > MAX_INTERVAL) {
    sendError("INVALID_INTERVAL", String("Interval must be ") + MIN_INTERVAL + "-" + MAX_INTERVAL + " ms");
    return;
  }

  strncpy(targetSSID, ssid, sizeof(targetSSID) - 1);
  targetSSID[sizeof(targetSSID) - 1] = '\0';

  strncpy(targetBSSID, bssid, sizeof(targetBSSID) - 1);
  targetBSSID[sizeof(targetBSSID) - 1] = '\0';

  // Initialize measurement
  currentSample  = 0;
  validSamples   = 0;
  stopRequested  = false;
  measurementId++;
  lastSampleTime = 0;  // Take first sample immediately

  currentState = STATE_MEASURING;

  // Send acknowledgement
  JsonDocument ack;
  ack["type"]           = "batch_start";
  ack["measurement_id"] = measurementId;
  ack["target_ssid"]    = targetSSID;
  ack["target_bssid"]   = targetBSSID;
  ack["count"]          = batchCount;
  ack["interval_ms"]    = intervalMs;
  ack["x_m"]            = coordX;
  ack["y_m"]            = coordY;
  ack["z_m"]            = coordZ;
  ack["node_id"]        = nodeId;
  sendJson(ack);
}

void handleStop() {
  if (currentState != STATE_MEASURING) {
    sendError("NOT_MEASURING", "No measurement in progress");
    return;
  }
  stopRequested = true;
}

void handleStatus() {
  JsonDocument doc;
  doc["type"]           = "status";
  doc["state"]          = stateToString(currentState);
  doc["node_id"]        = nodeId;
  doc["uptime_ms"]      = millis();
  doc["target_ssid"]    = targetSSID;
  doc["measurement_id"] = measurementId;
  doc["current_sample"] = currentSample;
  doc["valid_samples"]  = validSamples;
  doc["batch_count"]    = batchCount;
  doc["x_m"]            = coordX;
  doc["y_m"]            = coordY;
  doc["z_m"]            = coordZ;
  sendJson(doc);
}

// ─── Measurement Cycle ──────────────────────────────────────────
void handleMeasurement() {
  if (stopRequested) {
    finishBatch("stopped");
    return;
  }

  if (currentSample >= batchCount) {
    finishBatch("complete");
    return;
  }

  unsigned long now = millis();
  if (now - lastSampleTime < (unsigned long)intervalMs && lastSampleTime != 0) {
    return;  // Not time yet
  }

  lastSampleTime = now;
  currentSample++;

  // Perform a WiFi scan
  int n = WiFi.scanNetworks();

  if (n < 0) {
    // Scan failed
    JsonDocument doc;
    doc["type"]           = "measurement";
    doc["measurement_id"] = measurementId;
    doc["sample_index"]   = currentSample;
    doc["timestamp_ms"]   = millis();
    doc["target_ssid"]    = targetSSID;
    doc["bssid"]          = "";
    doc["channel"]        = 0;
    doc["rssi_dbm"]       = (char*)NULL;  // null for missing
    doc["x_m"]            = coordX;
    doc["y_m"]            = coordY;
    doc["z_m"]            = coordZ;
    doc["scan_status"]    = "scan_failed";
    doc["node_id"]        = nodeId;
    doc["networks_found"] = 0;
    sendJson(doc);
    WiFi.scanDelete();
    return;
  }

  // Find the target AP
  bool found = false;
  for (int i = 0; i < n; i++) {
    String ssid = WiFi.SSID(i);
    String bssid = WiFi.BSSIDstr(i);

    bool ssidMatch = (ssid == targetSSID);
    bool bssidMatch = (strlen(targetBSSID) == 0) || (bssid == targetBSSID);

    if (ssidMatch && bssidMatch) {
      // Found target AP
      JsonDocument doc;
      doc["type"]           = "measurement";
      doc["measurement_id"] = measurementId;
      doc["sample_index"]   = currentSample;
      doc["timestamp_ms"]   = millis();
      doc["target_ssid"]    = targetSSID;
      doc["bssid"]          = bssid;
      doc["channel"]        = WiFi.channel(i);
      doc["rssi_dbm"]       = WiFi.RSSI(i);
      doc["x_m"]            = coordX;
      doc["y_m"]            = coordY;
      doc["z_m"]            = coordZ;
      doc["scan_status"]    = "ok";
      doc["node_id"]        = nodeId;
      doc["networks_found"] = n;
      sendJson(doc);

      validSamples++;
      found = true;
      break;  // Use first match (or BSSID-specific match)
    }
  }

  if (!found) {
    // Target not found in scan results
    JsonDocument doc;
    doc["type"]           = "measurement";
    doc["measurement_id"] = measurementId;
    doc["sample_index"]   = currentSample;
    doc["timestamp_ms"]   = millis();
    doc["target_ssid"]    = targetSSID;
    doc["bssid"]          = "";
    doc["channel"]        = 0;
    doc["rssi_dbm"]       = (char*)NULL;  // null
    doc["x_m"]            = coordX;
    doc["y_m"]            = coordY;
    doc["z_m"]            = coordZ;
    doc["scan_status"]    = "target_not_found";
    doc["node_id"]        = nodeId;
    doc["networks_found"] = n;
    sendJson(doc);
  }

  WiFi.scanDelete();
}

void finishBatch(const char* reason) {
  currentState = STATE_IDLE;
  stopRequested = false;

  JsonDocument doc;
  doc["type"]           = "batch_complete";
  doc["measurement_id"] = measurementId;
  doc["total_samples"]  = currentSample;
  doc["valid_samples"]  = validSamples;
  doc["reason"]         = reason;
  doc["node_id"]        = nodeId;
  sendJson(doc);
}

// ─── Helpers ─────────────────────────────────────────────────────
void sendReady() {
  JsonDocument doc;
  doc["type"]     = "ready";
  doc["firmware"] = FIRMWARE_NAME;
  doc["version"]  = FIRMWARE_VERSION;
  doc["node_id"]  = nodeId;
  sendJson(doc);
}

void sendError(const char* code, const String& message) {
  JsonDocument doc;
  doc["type"]    = "error";
  doc["code"]    = code;
  doc["message"] = message;
  doc["node_id"] = nodeId;
  sendJson(doc);
}

void sendJson(JsonDocument& doc) {
  serializeJson(doc, Serial);
  Serial.println();  // Newline delimiter for JSON Lines
}

const char* stateToString(DeviceState s) {
  switch (s) {
    case STATE_IDLE:      return "idle";
    case STATE_MEASURING: return "measuring";
    case STATE_SCANNING:  return "scanning";
    default:              return "unknown";
  }
}
