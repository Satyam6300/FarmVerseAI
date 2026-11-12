"""FARMVERSE AI field-sensor backend.

Receives LoRa sensor readings (from the MQTT bridge, Node-RED or any HTTP client), stores them in
SQLite and serves them to the FARMVERSE dashboard.

  POST /api/readings     store one reading (requires header X-API-Key = FARMVERSE_INGEST_KEY)
  GET  /api/nodes        latest reading and last-seen time per node
  GET  /api/readings     readings for a node over the last N hours
  GET  /api/health       service status

Environment variables:
  FARMVERSE_DB               SQLite path (default: farmverse_iot.db)
  FARMVERSE_INGEST_KEY       required shared secret for POST /api/readings
  FARMVERSE_ALLOWED_ORIGINS  comma-separated origins allowed by CORS (default: http://localhost:8000)

Run:  uvicorn app:app --host 0.0.0.0 --port 8080
Readings are stored exactly as received; the service never generates values.
"""
import datetime as dt
import os
import sqlite3
from contextlib import contextmanager
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

DB = os.environ.get("FARMVERSE_DB", "farmverse_iot.db")
ORIGINS = [o.strip() for o in os.environ.get("FARMVERSE_ALLOWED_ORIGINS", "http://localhost:8000").split(",") if o.strip()]

app = FastAPI(title="FARMVERSE AI sensor backend", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=ORIGINS, allow_methods=["GET", "POST"], allow_headers=["Content-Type", "X-API-Key"])


@contextmanager
def db():
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    try:
        yield con
        con.commit()
    finally:
        con.close()


def init():
    with db() as con:
        con.execute("""CREATE TABLE IF NOT EXISTS readings (
            id INTEGER PRIMARY KEY AUTOINCREMENT, node_id TEXT NOT NULL, ts TEXT NOT NULL, received TEXT NOT NULL,
            soil_moisture_pct REAL, soil_temp_c REAL, air_temp_c REAL, rh_pct REAL, depth_cm REAL,
            battery_v REAL, rssi REAL, snr REAL, source TEXT)""")
        con.execute("CREATE INDEX IF NOT EXISTS ix_node_ts ON readings(node_id, ts)")


init()


class Reading(BaseModel):
    node_id: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_.:-]+$")
    ts: Optional[dt.datetime] = Field(None, description="Measurement time (ISO 8601). Defaults to the time received.")
    soil_moisture_pct: Optional[float] = Field(None, ge=0, le=100)
    soil_temp_c: Optional[float] = Field(None, ge=-20, le=80)
    air_temp_c: Optional[float] = Field(None, ge=-20, le=60)
    rh_pct: Optional[float] = Field(None, ge=0, le=100)
    depth_cm: Optional[float] = Field(None, ge=0, le=300)
    battery_v: Optional[float] = Field(None, ge=0, le=15)
    rssi: Optional[float] = Field(None, ge=-200, le=20)
    snr: Optional[float] = Field(None, ge=-40, le=40)
    source: Optional[str] = Field(None, max_length=32)


def require_key(x_api_key: Optional[str] = Header(None)):
    key = os.environ.get("FARMVERSE_INGEST_KEY")
    if not key:
        raise HTTPException(503, "Ingest disabled: FARMVERSE_INGEST_KEY is not set on the server")
    if x_api_key != key:
        raise HTTPException(401, "Invalid API key")


def now():
    return dt.datetime.now(dt.timezone.utc)


@app.get("/api/health")
def health():
    with db() as con:
        n = con.execute("SELECT COUNT(*) FROM readings").fetchone()[0]
    return {"status": "ok", "readings": n, "time": now().isoformat(timespec="seconds")}


@app.post("/api/readings", status_code=201, dependencies=[Depends(require_key)])
def add_reading(r: Reading):
    if not any(v is not None for v in [r.soil_moisture_pct, r.soil_temp_c, r.air_temp_c, r.rh_pct]):
        raise HTTPException(422, "Reading contains no measurement values")
    ts = (r.ts or now())
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=dt.timezone.utc)
    if ts > now() + dt.timedelta(minutes=10):
        raise HTTPException(422, "Measurement time is in the future")
    with db() as con:
        cur = con.execute("""INSERT INTO readings (node_id, ts, received, soil_moisture_pct, soil_temp_c, air_temp_c, rh_pct, depth_cm, battery_v, rssi, snr, source)
                             VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
                          (r.node_id, ts.astimezone(dt.timezone.utc).isoformat(timespec="seconds"), now().isoformat(timespec="seconds"), r.soil_moisture_pct, r.soil_temp_c,
                           r.air_temp_c, r.rh_pct, r.depth_cm, r.battery_v, r.rssi, r.snr, r.source))
    return {"id": cur.lastrowid}


@app.get("/api/nodes")
def nodes():
    with db() as con:
        rows = con.execute("""SELECT r.* FROM readings r JOIN (SELECT node_id, MAX(ts) AS mts FROM readings GROUP BY node_id) m
                              ON r.node_id = m.node_id AND r.ts = m.mts ORDER BY r.node_id""").fetchall()
    return {"nodes": [dict(x) for x in rows], "server_time": now().isoformat(timespec="seconds")}


@app.get("/api/readings")
def readings(node_id: str = Query(..., min_length=1, max_length=64), hours: int = Query(48, ge=1, le=24 * 31)):
    since = (now() - dt.timedelta(hours=hours)).isoformat(timespec="seconds")
    with db() as con:
        rows = con.execute("SELECT * FROM readings WHERE node_id = ? AND ts >= ? ORDER BY ts", (node_id, since)).fetchall()
    return {"node_id": node_id, "hours": hours, "readings": [dict(x) for x in rows]}
