import datetime as dt
import importlib
import os
import sys

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


def client(tmp_path, key="secret"):
    os.environ["FARMVERSE_DB"] = str(tmp_path / "t.db")
    if key:
        os.environ["FARMVERSE_INGEST_KEY"] = key
    else:
        os.environ.pop("FARMVERSE_INGEST_KEY", None)
    import app
    importlib.reload(app)
    return TestClient(app.app)


def test_ingest_and_read(tmp_path):
    c = client(tmp_path)
    ts = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=1)).isoformat()
    r = c.post("/api/readings", json={"node_id": "node-1", "ts": ts, "soil_moisture_pct": 23.5, "air_temp_c": 31.2, "depth_cm": 15}, headers={"X-API-Key": "secret"})
    assert r.status_code == 201
    n = c.get("/api/nodes").json()["nodes"]
    assert n[0]["node_id"] == "node-1" and n[0]["soil_moisture_pct"] == 23.5
    rs = c.get("/api/readings", params={"node_id": "node-1", "hours": 24}).json()["readings"]
    assert len(rs) == 1


def test_rejects_bad_key_and_values(tmp_path):
    c = client(tmp_path)
    assert c.post("/api/readings", json={"node_id": "n", "soil_moisture_pct": 20}, headers={"X-API-Key": "wrong"}).status_code == 401
    assert c.post("/api/readings", json={"node_id": "n", "soil_moisture_pct": 150}, headers={"X-API-Key": "secret"}).status_code == 422
    assert c.post("/api/readings", json={"node_id": "n"}, headers={"X-API-Key": "secret"}).status_code == 422
    future = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=1)).isoformat()
    assert c.post("/api/readings", json={"node_id": "n", "ts": future, "air_temp_c": 30}, headers={"X-API-Key": "secret"}).status_code == 422
    assert c.post("/api/readings", json={"node_id": "bad id!", "air_temp_c": 30}, headers={"X-API-Key": "secret"}).status_code == 422


def test_ingest_disabled_without_key(tmp_path):
    c = client(tmp_path, key=None)
    assert c.post("/api/readings", json={"node_id": "n", "air_temp_c": 30}).status_code == 503


def test_bridge_mapping():
    import mqtt_bridge as b
    msg = {"deviceInfo": {"devEui": "a84041"}, "time": "2026-11-12T10:00:00Z", "rxInfo": [{"rssi": -98, "snr": 7.5}], "object": {"water_SOIL": 21.4, "temp_SOIL": 26.1, "BatV": 3.6}}
    r = b.to_reading(msg)
    assert r["node_id"] == "a84041" and r["soil_moisture_pct"] == 21.4 and r["soil_temp_c"] == 26.1 and r["rssi"] == -98
    assert b.to_reading({"deviceInfo": {"devEui": "x"}, "object": {"BatV": 3.6}}) is None
