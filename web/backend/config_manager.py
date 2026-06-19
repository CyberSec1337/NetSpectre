import os
import json
import hashlib
import uuid

CONFIG_FILE = os.path.join(os.path.dirname(__file__), 'config.json')

DEFAULT_CONFIG = {
    "password_hash": hashlib.sha256("admin".encode()).hexdigest(),
    "telegram": {
        "enabled": False,
        "bot_token": "",
        "chat_id": ""
    },
    "static_rules": {},  # mac -> { "status": "limited" | "blocked" | "free", "limit": "1mbit" }
    "scheduler": [],     # list of dicts: { "id": "uuid", "mac": "mac", "action": "block"|"limit"|"free", "limit": "1mbit", "time_start": "22:00", "time_end": "06:00", "enabled": true }
}

def load_config():
    if not os.path.exists(CONFIG_FILE):
        save_config(DEFAULT_CONFIG)
        return DEFAULT_CONFIG
    try:
        with open(CONFIG_FILE, 'r') as f:
            data = json.load(f)
            if "telegram" not in data:
                data["telegram"] = DEFAULT_CONFIG["telegram"]
            return data
    except Exception as e:
        print(f"Error loading config: {e}")
        return DEFAULT_CONFIG

def save_config(config_dict):
    try:
        with open(CONFIG_FILE, 'w') as f:
            json.dump(config_dict, f, indent=4)
    except Exception as e:
        print(f"Error saving config: {e}")

# Global loaded configuration
config = load_config()
active_tokens = set()

def verify_password(plain_password):
    h = hashlib.sha256(plain_password.encode()).hexdigest()
    return h == config.get("password_hash")

def set_password(new_password):
    config["password_hash"] = hashlib.sha256(new_password.encode()).hexdigest()
    save_config(config)

def generate_token():
    t = str(uuid.uuid4())
    active_tokens.add(t)
    return t

def verify_token(token):
    # If password is empty (not set), allow access
    if not config.get("password_hash"):
        return True
    return token in active_tokens

def invalidate_token(token):
    if token in active_tokens:
        active_tokens.remove(token)
