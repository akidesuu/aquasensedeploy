import os
import joblib
import bcrypt
import certifi
import asyncio
import numpy as np
import pandas as pd
from enum import Enum
from collections import defaultdict
from datetime import datetime, timezone
from typing import List, Optional, Dict, Union

from fastapi import FastAPI, HTTPException, status, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field
from pymongo import MongoClient
from keras.models import load_model

# ==============================================================================
# 1. CONFIGURATION & FEATURE SELECTION
# ==============================================================================
LSTM_MODEL_FILE = os.getenv("LSTM_MODEL_PATH", "lstm_model copy.keras")
RF_MODEL_FILE = os.getenv("RF_MODEL_PATH", "rf_model.pkl")
SCALER_X_FILE = os.getenv("SCALER_X_PATH", "scaler_x.pkl")
SCALER_Y_FILE = os.getenv("SCALER_Y_PATH", "scaler_y.pkl")
TIME_STEPS = 3

raw_sensors = ['Temperature (°C)', 'pH', 'Turbidity (NTU)']
time_context = ['hour', 'day', 'month']
FEATURE_COLUMNS = raw_sensors + time_context
target = 'Dissolved Oxygen (mg/L)'

# ==============================================================================
# 2. FASTAPI & CORS & TEMPLATES SETUP
# ==============================================================================
app = FastAPI(title="AquaSense Core & ML Pipeline API", version="2.0.0")

templates = Jinja2Templates(directory="templates")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==============================================================================
# 3. MONGODB ATLAS CONNECTION (WITH SSL/TLS CERTIFI FIX)
# ==============================================================================
MONGO_URI = os.getenv(
    "MONGO_URI", 
    "mongodb+srv://aquasense_admin:123123123@aquasense.yjnnaj9.mongodb.net/?appName=aquasense"
)

try:
    mongo_client = MongoClient(
        MONGO_URI, 
        serverSelectionTimeoutMS=5000,
        tlsCAFile=certifi.where()
    )
    db = mongo_client['aquasense_db']
    mongo_client.server_info()
    print(">>> Success: Connected securely to MongoDB Atlas cluster.")
except Exception as e:
    print(f">>>> Warning: MongoDB database connection failed: {e}")
    db = None

# ==============================================================================
# 4. LOAD MACHINE LEARNING ARTIFACTS
# ==============================================================================
device_buffers: Dict[str, list] = defaultdict(list)

if all(os.path.exists(f) for f in [LSTM_MODEL_FILE, RF_MODEL_FILE, SCALER_X_FILE, SCALER_Y_FILE]):
    print(">>> Loading ML model artifacts into memory...")
    lstm_model = load_model(LSTM_MODEL_FILE)
    rf_model = joblib.load(RF_MODEL_FILE)
    scaler_x = joblib.load(SCALER_X_FILE)
    scaler_y = joblib.load(SCALER_Y_FILE)
    print(">>> ML artifacts loaded successfully.")
else:
    print(">>>> Warning: ML model artifacts not found. Ensure .keras and .pkl files are present.")
    lstm_model, rf_model, scaler_x, scaler_y = None, None, None, None

# ==============================================================================
# 5. SECURITY & ML PREDICTION UTILITIES
# ==============================================================================
def hash_password(password: str) -> str:
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt(12)
    return bcrypt.hashpw(password_bytes, salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password_str: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password_str.encode('utf-8'))
    except Exception as e:
        print(f"Bcrypt verification error: {e}")
        return False

def _run_hybrid_inference(buffer_records: list) -> float:
    input_df = pd.DataFrame(buffer_records)
    input_df_features = input_df[FEATURE_COLUMNS]

    X_scaled = scaler_x.transform(input_df_features.values)
    X_seq = np.expand_dims(X_scaled, axis=0)

    trend = lstm_model.predict(X_seq, verbose=0)

    current_raw = X_scaled[-1].reshape(1, -1)
    hybrid_input = np.hstack((current_raw, trend))

    pred_scaled = rf_model.predict(hybrid_input)
    prediction = scaler_y.inverse_transform(pred_scaled.reshape(-1, 1))

    return float(prediction[0][0])

async def predict_dissolved_oxygen(device_id: str, sensor_dict: dict) -> dict:
    if not all([lstm_model, rf_model, scaler_x, scaler_y]):
        return {"status": "error", "message": "ML models are not loaded on server."}

    buf = device_buffers[device_id]
    buf.append(sensor_dict)

    while len(buf) < TIME_STEPS:
        buf.insert(0, sensor_dict)

    if len(buf) > TIME_STEPS:
        buf.pop(0)

    predicted_do = await asyncio.to_thread(_run_hybrid_inference, buf)

    return {
        "status": "success",
        "dissolved_oxygen_mg_L": round(predicted_do, 4)
    }

# ==============================================================================
# 6. PYDANTIC SCHEMAS & ENUMS
# ==============================================================================
class UserRole(str, Enum):
    SUPER_ADMIN = "Super Admin"
    ADMIN = "Admin"
    FARMER = "Farmer"

class AccountStatus(str, Enum):
    ACTIVE = "Active"
    INACTIVE = "Inactive"

class TelemetryPayload(BaseModel):
    device_id: str = Field("ESP32_POND_01", json_schema_extra={"example": "ESP32_POND_01"})
    temperature: float = Field(..., json_schema_extra={"example": 28.5})
    ph: float = Field(..., json_schema_extra={"example": 7.2})
    turbidity: float = Field(..., json_schema_extra={"example": 15.0})
    precipitation: float = Field(0.0, json_schema_extra={"example": 0.0})

class UserAuthPayload(BaseModel):
    email: Optional[str] = Field(None, json_schema_extra={"example": "lennon@aquasense.com"})
    username: Optional[str] = Field(None, json_schema_extra={"example": "Chavez"})
    password: str = Field(..., json_schema_extra={"example": "AquaSecure2026!"})

class AccountCreatePayload(BaseModel):
    id: str = Field(..., json_schema_extra={"example": "USR-001"})
    name: str = Field(..., json_schema_extra={"example": "Akimitsu Admin"})
    email: str = Field(..., json_schema_extra={"example": "admin@aquasense.io"})
    location: str = Field(..., json_schema_extra={"example": "Cagayan de Oro"})
    role: UserRole = Field(UserRole.FARMER, json_schema_extra={"example": "Farmer"})
    status: AccountStatus = Field(AccountStatus.ACTIVE, json_schema_extra={"example": "Active"})
    password: Optional[str] = Field(None, json_schema_extra={"example": "SecurePass2026!"})
    createdAt: Optional[str] = None

class AccountUpdatePayload(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    location: Optional[str] = None
    role: Optional[UserRole] = None
    status: Optional[AccountStatus] = None
    password: Optional[str] = None
    createdAt: Optional[str] = None

class AccountResponse(BaseModel):
    id: str
    name: str
    email: str
    location: str
    role: str
    status: str
    createdAt: str

class DeviceCreatePayload(BaseModel):
    id: str = Field(..., json_schema_extra={"example": "ESP32_POND_01"})
    device_id: str = Field(..., json_schema_extra={"example": "ESP32_POND_01"})
    name: str = Field(..., json_schema_extra={"example": "Ponderosa Node 1"})
    location: str = Field(..., json_schema_extra={"example": "Zone 3, BonBon Pond"})
    assignedUserId: Optional[Union[str, int]] = Field(None, json_schema_extra={"example": "USR-001"})
    assignedUserName: Optional[str] = Field(None, json_schema_extra={"example": "Akimitsu Admin"})
    status: str = Field("Online", json_schema_extra={"example": "Online"})
    color: str = Field("#22c55e", json_schema_extra={"example": "#22c55e"})

class DeviceUpdatePayload(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    assignedUserId: Optional[Union[str, int]] = None
    assignedUserName: Optional[str] = None
    status: Optional[str] = None
    color: Optional[str] = None
    assigned_user: Optional[Union[str, int]] = None
    assigned_user_id: Optional[Union[str, int]] = None

class DeviceResponse(BaseModel):
    id: str
    device_id: str
    name: str
    location: str
    assignedUserId: Optional[Union[str, int]] = None
    assignedUserName: Optional[str] = None
    status: str
    color: str

# ==============================================================================
# 7. API ENDPOINTS
# ==============================================================================

@app.get("/", response_class=HTMLResponse)
async def root_check(request: Request):
    if os.path.exists("templates/index.html"):
        return templates.TemplateResponse(request=request, name="index.html")
    return HTMLResponse("<h2>AquaSense Core & ML API Active</h2>")

# ------------------------------------------------------------------------------
# AUTHENTICATION ENDPOINTS
# ------------------------------------------------------------------------------
@app.post("/auth/register", status_code=status.HTTP_201_CREATED)
def register_user(payload: UserAuthPayload):
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection is unavailable.")
    
    user_identifier = (payload.email or payload.username or "").strip()
    if not user_identifier:
        raise HTTPException(status_code=400, detail="Email or username is required.")
    
    existing_account = db['accounts'].find_one({
        "$or": [
            {"email": user_identifier.lower()},
            {"name": user_identifier}
        ]
    })
    
    if existing_account:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Account with this email or username already exists."
        )
    
    try:
        now_dt = datetime.now(timezone.utc)
        created_at_str = now_dt.strftime("%Y-%m-%d %I:%M %p")
        next_id = f"USR-{db['accounts'].count_documents({}) + 1:03d}"
        
        account_doc = {
            "id": next_id,
            "name": user_identifier.split("@")[0] if "@" in user_identifier else user_identifier,
            "email": user_identifier.lower() if "@" in user_identifier else f"{user_identifier}@aquasense.local",
            "location": "Unassigned",
            "role": UserRole.FARMER.value,
            "status": AccountStatus.ACTIVE.value,
            "password_hash": hash_password(payload.password),
            "createdAt": created_at_str,
            "created_at_dt": now_dt
        }
        
        db['accounts'].insert_one(account_doc)
        return {"message": f"Account '{user_identifier}' registered successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/auth/login")
def login_user(payload: UserAuthPayload):
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection is unavailable.")
    
    user_identifier = (payload.email or payload.username or "").strip()
    if not user_identifier:
        raise HTTPException(status_code=400, detail="Email or username is required.")

    user_record = db['accounts'].find_one({
        "$or": [
            {"email": user_identifier.lower()},
            {"name": user_identifier}
        ]
    })
    
    if not user_record or not verify_password(payload.password, user_record.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Invalid email or password configuration."
        )
        
    return {
        "status": "Authenticated",
        "username": user_record.get("name", user_identifier),
        "email": user_record.get("email", user_identifier),
        "role": user_record.get("role", "Farmer"),
        "message": "Access granted to AquaSense control panel."
    }

# ------------------------------------------------------------------------------
# ACCOUNT MANAGEMENT ENDPOINTS
# ------------------------------------------------------------------------------
@app.get("/api/accounts", response_model=List[AccountResponse])
@app.get("/api/accounts/", response_model=List[AccountResponse])
def get_all_accounts():
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection is unavailable.")

    cursor = db['accounts'].find().sort("created_at_dt", -1)
    accounts = []
    
    for doc in cursor:
        accounts.append(AccountResponse(
            id=doc.get("id", ""),
            name=doc.get("name", ""),
            email=doc.get("email", ""),
            location=doc.get("location", ""),
            role=doc.get("role", "Farmer"),
            status=doc.get("status", "Active"),
            createdAt=doc.get("createdAt", "")
        ))

    return accounts

@app.post("/api/accounts", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
@app.post("/api/accounts/create/", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
def create_account(payload: AccountCreatePayload):
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection is unavailable.")
    
    clean_id = payload.id.strip()
    clean_email = payload.email.strip().lower()

    existing = db['accounts'].find_one({
        "$or": [{"id": clean_id}, {"email": clean_email}]
    })

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this ID or Email already exists."
        )

    now_dt = datetime.now(timezone.utc)
    created_at_str = payload.createdAt if payload.createdAt else now_dt.strftime("%Y-%m-%d %I:%M %p")
    raw_password = payload.password if payload.password else "AquaSense123!"

    account_doc = {
        "id": clean_id,
        "name": payload.name.strip(),
        "email": clean_email,
        "location": payload.location.strip(),
        "role": payload.role.value,
        "status": payload.status.value,
        "password_hash": hash_password(raw_password),
        "createdAt": created_at_str,
        "created_at_dt": now_dt
    }

    db['accounts'].insert_one(account_doc)

    return AccountResponse(
        id=account_doc["id"],
        name=account_doc["name"],
        email=account_doc["email"],
        location=account_doc["location"],
        role=account_doc["role"],
        status=account_doc["status"],
        createdAt=account_doc["createdAt"]
    )

@app.put("/api/accounts/{account_id}", response_model=AccountResponse)
@app.put("/api/accounts/{account_id}/", response_model=AccountResponse)
def update_account(account_id: str, payload: AccountUpdatePayload):
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection is unavailable.")

    existing_doc = db['accounts'].find_one({"id": account_id})
    if not existing_doc:
        raise HTTPException(status_code=404, detail="Account not found.")

    update_fields = {}
    
    if payload.name:
        update_fields["name"] = payload.name.strip()
    if payload.email:
        clean_email = payload.email.strip().lower()
        duplicate_check = db['accounts'].find_one({"email": clean_email, "id": {"$ne": account_id}})
        if duplicate_check:
            raise HTTPException(status_code=409, detail="Email is already used by another account.")
        update_fields["email"] = clean_email
    if payload.location:
        update_fields["location"] = payload.location.strip()
    if payload.role:
        update_fields["role"] = payload.role.value
    if payload.status:
        update_fields["status"] = payload.status.value
    if payload.password and payload.password.strip():
        if len(payload.password.strip()) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
        update_fields["password_hash"] = hash_password(payload.password.strip())

    if update_fields:
        db['accounts'].update_one({"id": account_id}, {"$set": update_fields})

    updated_doc = db['accounts'].find_one({"id": account_id})

    return AccountResponse(
        id=updated_doc["id"],
        name=updated_doc["name"],
        email=updated_doc["email"],
        location=updated_doc["location"],
        role=updated_doc["role"],
        status=updated_doc["status"],
        createdAt=updated_doc.get("createdAt", "")
    )

@app.delete("/api/accounts/{account_id}", status_code=status.HTTP_200_OK)
@app.delete("/api/accounts/{account_id}/", status_code=status.HTTP_200_OK)
def delete_account(account_id: str):
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection is unavailable.")

    result = db['accounts'].delete_one({"id": account_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Account not found.")
    
    return {"message": f"Account '{account_id}' deleted successfully."}

# ------------------------------------------------------------------------------
# DEVICE MANAGEMENT ENDPOINTS
# ------------------------------------------------------------------------------
@app.get("/api/devices", response_model=List[DeviceResponse])
@app.get("/api/devices/", response_model=List[DeviceResponse])
def get_all_devices():
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection is unavailable.")

    cursor = db['devices'].find()
    devices = []
    
    for doc in cursor:
        devices.append(DeviceResponse(
            id=doc.get("id", doc.get("device_id", "")),
            device_id=doc.get("device_id", ""),
            name=doc.get("name", ""),
            location=doc.get("location", "Unassigned"),
            assignedUserId=doc.get("assignedUserId"),
            assignedUserName=doc.get("assignedUserName"),
            status=doc.get("status", "Online"),
            color=doc.get("color", "#22c55e")
        ))

    return devices

@app.post("/api/devices", response_model=DeviceResponse, status_code=status.HTTP_201_CREATED)
@app.post("/api/devices/create/", response_model=DeviceResponse, status_code=status.HTTP_201_CREATED)
def register_device(payload: DeviceCreatePayload):
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection is unavailable.")
    
    existing = db['devices'].find_one({"device_id": payload.device_id})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Device with ID '{payload.device_id}' already exists."
        )

    device_doc = payload.model_dump()
    db['devices'].insert_one(device_doc)

    return DeviceResponse(**device_doc)

def _process_device_update(device_id: str, payload: DeviceUpdatePayload):
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection is unavailable.")

    existing_doc = db['devices'].find_one({"$or": [{"id": device_id}, {"device_id": device_id}]})
    if not existing_doc:
        raise HTTPException(status_code=404, detail="Device not found.")

    raw_data = payload.model_dump(exclude_unset=True)
    update_fields = {}
    
    for k, v in raw_data.items():
        if v is not None:
            update_fields[k] = v

    if "assigned_user" in update_fields and "assignedUserId" not in update_fields:
        update_fields["assignedUserId"] = update_fields.pop("assigned_user")
    if "assigned_user_id" in update_fields and "assignedUserId" not in update_fields:
        update_fields["assignedUserId"] = update_fields.pop("assigned_user_id")

    if update_fields.get("assignedUserId") and not update_fields.get("assignedUserName"):
        account = db['accounts'].find_one({"id": str(update_fields["assignedUserId"])})
        if account:
            update_fields["assignedUserName"] = account.get("name")

    if update_fields:
        db['devices'].update_one(
            {"$or": [{"id": device_id}, {"device_id": device_id}]},
            {"$set": update_fields}
        )

    updated_doc = db['devices'].find_one({"$or": [{"id": device_id}, {"device_id": device_id}]})

    return DeviceResponse(
        id=updated_doc.get("id", updated_doc.get("device_id")),
        device_id=updated_doc.get("device_id"),
        name=updated_doc.get("name"),
        location=updated_doc.get("location"),
        assignedUserId=updated_doc.get("assignedUserId"),
        assignedUserName=updated_doc.get("assignedUserName"),
        status=updated_doc.get("status", "Online"),
        color=updated_doc.get("color", "#22c55e")
    )

@app.put("/api/devices/{device_id}", response_model=DeviceResponse)
@app.put("/api/devices/{device_id}/", response_model=DeviceResponse)
def update_device_put(device_id: str, payload: DeviceUpdatePayload):
    return _process_device_update(device_id, payload)

@app.patch("/api/devices/{device_id}", response_model=DeviceResponse)
@app.patch("/api/devices/{device_id}/", response_model=DeviceResponse)
def update_device_patch(device_id: str, payload: DeviceUpdatePayload):
    return _process_device_update(device_id, payload)

@app.delete("/api/devices/{device_id}", status_code=status.HTTP_200_OK)
@app.delete("/api/devices/{device_id}/", status_code=status.HTTP_200_OK)
def delete_device(device_id: str):
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection is unavailable.")

    result = db['devices'].delete_one({"$or": [{"id": device_id}, {"device_id": device_id}]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Device not found.")
    
    return {"message": f"Device '{device_id}' deleted successfully."}

# ------------------------------------------------------------------------------
# TELEMETRY & PREDICTION ENDPOINTS
# ------------------------------------------------------------------------------
@app.post("/telemetry", status_code=status.HTTP_201_CREATED)
async def receive_telemetry(payload: TelemetryPayload):
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection is unavailable.")
    
    now = datetime.now(timezone.utc)
    
    sensor_record = {
        'Temperature (°C)': payload.temperature,
        'pH': payload.ph,
        'Turbidity (NTU)': payload.turbidity,
        'hour': now.hour,
        'day': now.day,
        'month': now.month
    }
    
    ml_result = await predict_dissolved_oxygen(payload.device_id, sensor_record)
    predicted_do = ml_result.get("dissolved_oxygen_mg_L", None)
    
    telemetry_doc = {
        "device_id": payload.device_id,
        "temperature": payload.temperature,
        "ph": payload.ph,
        "turbidity": payload.turbidity,
        "precipitation": payload.precipitation,
        "predicted_do": predicted_do,
        "timestamp": now
    }
    db['raw_telemetry'].insert_one(telemetry_doc)

    log_doc = {
        "device_id": payload.device_id,
        "temperature": payload.temperature,
        "ph": payload.ph,
        "turbidity": payload.turbidity,
        "precipitation": payload.precipitation,
        "predicted_do": predicted_do,
        "status": ml_result.get("status"),
        "timestamp": now
    }
    db['prediction_logs'].insert_one(log_doc)

    return {
        "message": "Telemetry packet validated and logged successfully.",
        "telemetry": payload.model_dump(),
        "prediction": ml_result
    }

@app.get("/telemetry")
def get_telemetry():
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection is unavailable.")
    
    try:
        cursor = db['raw_telemetry'].find().sort("timestamp", -1).limit(10)
        telemetry_records = []
        for record in cursor:
            record["_id"] = str(record["_id"])
            telemetry_records.append(record)
        return telemetry_records
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/telemetry/latest")
def get_latest_telemetry(device_id: Optional[str] = None):
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection is unavailable.")
    
    try:
        query = {"device_id": device_id} if device_id else {}
        
        if device_id:
            device_exists = db['devices'].find_one({"$or": [{"id": device_id}, {"device_id": device_id}]})
            if not device_exists:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Device with ID '{device_id}' does not exist."
                )

        latest_record = db['raw_telemetry'].find_one(query, sort=[("timestamp", -1)])
        
        if not latest_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail=f"No telemetry data found for device '{device_id}'." if device_id else "No telemetry data found."
            )
        
        latest_record["_id"] = str(latest_record["_id"])
        return latest_record
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/telemetry/history")
def get_telemetry_history(limit: int = Query(50, ge=1, le=500), device_id: Optional[str] = None):
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection is unavailable.")
    
    try:
        query = {"device_id": device_id} if device_id else {}
        cursor = db['raw_telemetry'].find(query).sort("timestamp", -1).limit(limit)
        
        history = []
        for record in cursor:
            record["_id"] = str(record["_id"])
            history.append(record)
            
        return history
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict")
async def run_predict_endpoint(payload: TelemetryPayload):
    now = datetime.now(timezone.utc)
    sensor_record = {
        'Temperature (°C)': payload.temperature,
        'pH': payload.ph,
        'Turbidity (NTU)': payload.turbidity,
        'hour': now.hour,
        'day': now.day,
        'month': now.month
    }
    
    ml_result = await predict_dissolved_oxygen(payload.device_id, sensor_record)
    
    return {
        "predicted_do": ml_result.get("dissolved_oxygen_mg_L", 7.0),
        "status": ml_result.get("status", "success"),
        "device_id": payload.device_id
    }

@app.get("/predict")
def get_latest_prediction():
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection is unavailable.")
    
    try:
        latest_record = db['prediction_logs'].find_one(sort=[("timestamp", -1)])
        
        if not latest_record:
            return {
                "message": "No machine learning logs compiled yet.",
                "predicted_do": 7.0,
                "status": "Stable"
            }
        
        latest_record["_id"] = str(latest_record["_id"])
        return latest_record
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == '__main__':
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)