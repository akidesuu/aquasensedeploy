import os
import sys
from pymongo import MongoClient
from pymongo.errors import PyMongoError, ConnectionFailure

MONGO_URI = os.getenv(
    "MONGO_URI", 
    "mongodb+srv://aquasense_admin:123123123@aquasense.yjnnaj9.mongodb.net/?appName=aquasense"
)

def seed_devices():
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        client.admin.command('ping')
        print("Connected securely to MongoDB Atlas.")

        db = client['aquasense_db']

        default_devices = [
            {
                "id": "ESP32_POND_01",
                "device_id": "ESP32_POND_01",
                "name": "Node ESP32_POND_01",
                "location": "BonBon",
                "assignedUserId": "USR-002",
                "assignedUserName": "John Rey Nillama (BonBon)",
                "status": "Online",
                "color": "#22c55e"
            },
        ]

        updated_count = 0
        inserted_count = 0

        for device in default_devices:
            result = db['devices'].update_one(
                {"id": device["id"]},
                {"$set": device},
                upsert=True
            )
            
            if result.upserted_id:
                inserted_count += 1
            elif result.modified_count > 0:
                updated_count += 1

        print(f"Database seed complete: {inserted_count} inserted, {updated_count} updated.")

    except ConnectionFailure:
        print("Error: Could not connect to MongoDB Atlas.", file=sys.stderr)
    except PyMongoError as e:
        print(f"MongoDB Error: {e}", file=sys.stderr)
    finally:
        if 'client' in locals():
            client.close()

if __name__ == "__main__":
    seed_devices()