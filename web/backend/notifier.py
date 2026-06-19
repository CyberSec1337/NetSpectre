import urllib.request
import urllib.parse
import json
import threading
from config_manager import config

def send_telegram_async(message):
    telegram_settings = config.get("telegram", {})
    if not telegram_settings.get("enabled"):
        return
    
    def _send():
        try:
            bot_token = telegram_settings.get("bot_token", "")
            chat_id = telegram_settings.get("chat_id", "")
            
            if not bot_token or not chat_id:
                print("⚠️ Telegram bot token or chat ID missing.")
                return
                
            url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
            payload = {
                "chat_id": chat_id,
                "text": message,
                "parse_mode": "Markdown"
            }
            
            data = json.dumps(payload).encode('utf-8')
            req = urllib.request.Request(
                url, 
                data=data, 
                headers={'Content-Type': 'application/json'},
                method='POST'
            )
            
            with urllib.request.urlopen(req, timeout=10) as response:
                res_data = response.read()
                print("✉️ Telegram notification message dispatched successfully.")
        except Exception as e:
            print(f"❌ Telegram Bot Error: {e}")
            
    threading.Thread(target=_send, daemon=True).start()
