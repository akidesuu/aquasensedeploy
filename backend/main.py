from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pymongo import MongoClient
from datetime import datetime
from typing import List, Optional
import bcrypt

app = FastAPI(title="AquaSense Core API", version="1.0.0")

# ==============================================================================
# 1. CORS CONFIGURATION (Allows Web & Mobile Frontends to Connect)
# ==============================================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows connections from any IP (great for local network testing)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==============================================================================
# 2. MONGODB ATLAS CONNECTION
# ==============================================================================
MONGO_URI = "mongodb+srv://aquasense_admin:123123123@aquasense.yjnnaj9.mongodb.net/?appName=aquasense"

try:
    mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    db = mongo_client['aquasense_db']
    mongo_client.server_info()  # Ping test
    print(">>> Success: Connected securely to MongoDB Atlas cluster.")
except Exception as e:
    print(f">>>> Warning: MongoDB database connection failed: {e}")
    db = None

# ==============================================================================
# 3. BCRYPT SECURITY UTILITIES
# ==============================================================================
def hash_password(password: str) -> str:
    """
    Hashes a plain-text password using a secure random salt.
    Returns a string safe for storage in MongoDB.
    """
    # Convert text to bytes
    password_bytes = password.encode('utf-8')
    # Generate random salt and hash
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    # Decode back to plain string format
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Compares an incoming plain-text password against the stored database hash.
    """
    return bcrypt.checkpw(
        plain_password.encode('utf-8'),
        hashed_password.encode('utf-8')
    )

# ==============================================================================
# 4. PYDANTIC SCHEMAS (Data Validation Layouts)
# ==============================================================================
class TelemetryPayload(BaseModel):
    device_id: str = Field(..., example="ESP32_POND_01")
    temperature: float = Field(..., example=28.5)
    ph: float = Field(..., example=7.2)
    turbidity: float = Field(..., example=15.0)

# New Payload Schemas for Account Administration & Controls
class UserAuthPayload(BaseModel):
    username: str = Field(..., example="admin_akimitsu")
    password: str = Field(..., example="AquaSecure2026!")

# ==============================================================================
# 5. API ENDPOINTS
# ==============================================================================

@app.get("/")
def root_check():
    return {"status": "Online", "system": "AquaSense API Core (FastAPI)"}


# --- USER AUTHENTICATION & MANAGEMENT ENDPOINTS ---

@app.post("/auth/register", status_code=status.HTTP_201_CREATED)
def register_user(payload: UserAuthPayload):
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection is unavailable.")
    
    # Enforce uniqueness of usernames
    existing_user = db['users'].find_one({"username": payload.username})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Username is already registered in the system."
        )
    
    try:
        # Secure password using bcrypt utility
        secured_password_hash = hash_password(payload.password)
        
        user_doc = {
            "username": payload.username,
            "password_hash": secured_password_hash,
            "created_at": datetime.now()
        }
        
        db['users'].insert_one(user_doc)
        return {"message": f"Account '{payload.username}' registered and secured successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/auth/login")
def login_user(payload: UserAuthPayload):
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection is unavailable.")
    
    # Retrieve user from collection
    user_record = db['users'].find_one({"username": payload.username})
    if not user_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Invalid username or password configuration."
        )
    
    # Verify incoming string against hashed string via bcrypt
    is_valid = verify_password(payload.password, user_record["password_hash"])
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Invalid username or password configuration."
        )
        
    return {
        "status": "Authenticated",
        "username": user_record["username"],
        "message": "Access granted to Super Admin panel."
    }


# --- IOT NODE TELEMETRY & PREDICTIONS ENDPOINTS ---

@app.post("/telemetry", status_code=status.HTTP_201_CREATED)
def receive_telemetry(payload: TelemetryPayload):
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection is unavailable.")
    
    try:
        telemetry_doc = payload.dict()
        telemetry_doc["timestamp"] = datetime.now()
        
        db['raw_telemetry'].insert_one(telemetry_doc)
        return {"message": "Telemetry packet validated and logged successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/predict")
def get_latest_prediction():
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection is unavailable.")
    
    try:
        latest_record = db['prediction_logs'].find_one(sort=[("timestamp", -1)])
        
        if not latest_record:
            return {
                "message": "No machine learning logs compiled yet.",
                "predicted_do": 7.0,  # Default safe fallback numbers for UI testing
                "status": "Stable"
            }
        
        latest_record["_id"] = str(latest_record["_id"])
        return latest_record
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))