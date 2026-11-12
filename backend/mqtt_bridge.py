"""Bridge LoRa uplinks from an MQTT broker into the FARMVERSE backend.

Works with a Dragino or other LoRaWAN gateway whose network server (for example ChirpStack or
The Things Stack) publishes decoded uplinks to MQTT, or with Node-RED publishing plain JSON.

Expected message: JSON containing a decoded object. Field names are mapped with FIELD_MAP below;
adjust it to match your payload decoder. Nothing is stored if no mapped measurement is present.

Environment variables:
  MQTT_HOST (default localhost), MQTT_PORT (1883), MQTT_TOPIC (default "application/+/device/+/event/up"),
  MQTT_USER, MQTT_PASS, FARMVERSE_API (default http://localhost:8080), FARMVERSE_INGEST_KEY

Run:  python3 mqtt_bridge.py
Not yet tested against the team's hardware: confirm the topic and decoded field names first.
"""
import json
import os
import urllib.request

import paho.mqtt.client as mqtt

FIELD_MAP = {  # decoded payload key -> FARMVERSE field
    "soil_moisture": "soil_moisture_pct", "water_SOIL": "soil_moisture_pct", "soil_moisture_pct": "soil_moisture_pct",
    "soil_temp": "soil_temp_c", "temp_SOIL": "soil_temp_c", "soil_temp_c": "soil_temp_c",
    "air_temp": "air_temp_c", "TempC_SHT": "air_temp_c", "air_temp_c": "air_temp_c",
    "humidity": "rh_pct", "Hum_SHT": "rh_pct", "rh_pct": "rh_pct",
    "battery": "battery_v", "BatV": "battery_v", "depth_cm": "depth_cm",
}


def to_reading(msg: dict):
    obj = msg.get("object") or msg.get("decoded_payload") or (msg.get("uplink_message") or {}).get("decoded_payload") or msg
    out = {}
    for k, v in obj.items():
        if k in FIELD_MAP and isinstance(v, (int, float, str)):
            try:
                out[FIELD_MAP[k]] = float(v)
            except ValueError:
                pass
    if not any(f in out for f in ["soil_moisture_pct", "soil_temp_c", "air_temp_c", "rh_pct"]):
        return None
    dev = msg.get("deviceInfo", {}).get("devEui") or msg.get("devEUI") or (msg.get("end_device_ids") or {}).get("dev_eui") or msg.get("node_id")
    if not dev:
        return None
    out["node_id"] = str(dev)
    rx = msg.get("rxInfo") or (msg.get("uplink_message") or {}).get("rx_metadata") or []
    if rx and isinstance(rx, list):
        out["rssi"] = rx[0].get("rssi"); out["snr"] = rx[0].get("snr") or rx[0].get("loRaSNR")
    t = msg.get("time") or msg.get("received_at")
    if t:
        out["ts"] = t
    out["source"] = "mqtt"
    return out


def post(reading):
    req = urllib.request.Request(os.environ.get("FARMVERSE_API", "http://localhost:8080") + "/api/readings", data=json.dumps(reading).encode(),
                                 headers={"Content-Type": "application/json", "X-API-Key": os.environ.get("FARMVERSE_INGEST_KEY", "")}, method="POST")
    with urllib.request.urlopen(req, timeout=10) as r:
        return r.status


def on_message(client, userdata, m):
    try:
        r = to_reading(json.loads(m.payload))
        if r:
            print("stored", r["node_id"], post(r))
        else:
            print("skipped message without mapped measurements on", m.topic)
    except Exception as e:  # keep the bridge running
        print("error:", e)


def main():
    c = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    if os.environ.get("MQTT_USER"):
        c.username_pw_set(os.environ["MQTT_USER"], os.environ.get("MQTT_PASS"))
    c.on_message = on_message
    c.connect(os.environ.get("MQTT_HOST", "localhost"), int(os.environ.get("MQTT_PORT", "1883")))
    c.subscribe(os.environ.get("MQTT_TOPIC", "application/+/device/+/event/up"))
    c.loop_forever()


if __name__ == "__main__":
    main()
