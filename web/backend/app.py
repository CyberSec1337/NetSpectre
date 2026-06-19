"""
NetSpectre Console Web Backend
 Flask + SocketIO server with real network implementation
 Supports fallback to demo data if run without root privileges
"""
import sys
import os
import time
import random
import threading
import json
from datetime import datetime
from flask import Flask, jsonify, request, send_from_directory, make_response
from flask_socketio import SocketIO, emit
from flask_cors import CORS

import config_manager
import oui_database
import notifier
import scheduler

# Add evillimiter parent directory to python path
NETSPECTRE_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
if NETSPECTRE_PATH not in sys.path:
    sys.path.insert(0, NETSPECTRE_PATH)

# Pre-init colorama to avoid circular imports in evillimiter console modules
import colorama
colorama.init(autoreset=True)

app = Flask(__name__, static_folder='../frontend', static_url_path='')
app.config['SECRET_KEY'] = 'netspectre-secret-2024'
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# ─── Global State ─────────────────────────────────────────────────────────────
REAL_MODE = False
network_settings = {}
hosts_list = []
hosts_lock = threading.Lock()
ACTIVITY_LOG = []
DEVICE_ALIASES = {}

ALIASES_FILE = os.path.join(os.path.dirname(__file__), 'aliases.json')

def load_aliases():
    global DEVICE_ALIASES
    try:
        if os.path.exists(ALIASES_FILE):
            with open(ALIASES_FILE, 'r') as f:
                DEVICE_ALIASES = json.load(f)
        else:
            DEVICE_ALIASES = {}
    except Exception as e:
        print(f"  ❌ Error loading aliases: {e}")
        DEVICE_ALIASES = {}

def save_aliases():
    try:
        with open(ALIASES_FILE, 'w') as f:
            json.dump(DEVICE_ALIASES, f, indent=4)
    except Exception as e:
        print(f"  ❌ Error saving aliases: {e}")

# Core networking objects (for Real Mode)
host_scanner = None
arp_spoofer = None
limiter = None
bandwidth_monitor = None
host_watcher = None

# Fallback Demo Data
DEMO_HOSTS = [
    {"id": 0, "ip": "192.168.1.1",   "mac": "a4:91:b1:22:33:44", "name": "Gateway Router",      "vendor": "Cisco",    "type": "router",  "status": "free",    "upload": 0,    "download": 0,    "total_up": 0,   "total_down": 0,  "limit": None,  "watched": False},
    {"id": 1, "ip": "192.168.1.10",  "mac": "b8:27:eb:aa:bb:cc", "name": "MacBook-Pro",         "vendor": "Apple",    "type": "laptop",  "status": "limited", "upload": 512,  "download": 2048, "total_up": 45,  "total_down": 320, "limit": "5mbit","watched": True},
    {"id": 2, "ip": "192.168.1.15",  "mac": "dc:a6:32:11:22:33", "name": "iPhone-14",           "vendor": "Apple",    "type": "phone",   "status": "free",    "upload": 128,  "download": 768,  "total_up": 12,  "total_down": 87, "limit": None,  "watched": False},
    {"id": 3, "ip": "192.168.1.20",  "mac": "00:1a:2b:3c:4d:5e", "name": "DESKTOP-WIN11",       "vendor": "Dell",     "type": "desktop", "status": "blocked", "upload": 0,    "download": 0,    "total_up": 102, "total_down": 540,"limit": None,  "watched": True},
]

# ─── Helper Functions ─────────────────────────────────────────────────────────
def _log(log_type, message):
    entry = {
        "time": datetime.now().strftime("%H:%M:%S"),
        "type": log_type,
        "message": message,
    }
    ACTIVITY_LOG.insert(0, entry)
    if len(ACTIVITY_LOG) > 100:
        ACTIVITY_LOG.pop()
    socketio.emit('new_log', entry)

def get_device_type(name):
    if not name:
        return "unknown"
    name = name.lower()
    if "router" in name or "gateway" in name:
        return "router"
    if "phone" in name or "iphone" in name or "android" in name:
        return "phone"
    if "macbook" in name or "laptop" in name or "notebook" in name:
        return "laptop"
    if "desktop" in name or "pc" in name or "workstation" in name:
        return "desktop"
    if "tv" in name or "smarttv" in name:
        return "tv"
    if "camera" in name or "cam" in name:
        return "camera"
    return "unknown"

def get_vendor(mac):
    return oui_database.resolve_vendor(mac)

# ─── Initialize Real networking ───────────────────────────────────────────────
def initialize_real_network():
    global REAL_MODE, network_settings, host_scanner, arp_spoofer, limiter, bandwidth_monitor, host_watcher
    
    if os.geteuid() != 0:
        print("\n  ❌ WARNING: Not running as root (sudo). Real network monitoring is disabled.")
        print("  💡 Backend will start in Demo/Simulation Mode.")
        return False
        
    try:
        import netspectre.networking.utils as netutils
        from netspectre.networking.host import Host
        from netspectre.networking.scan import HostScanner
        from netspectre.networking.spoof import ARPSpoofer
        from netspectre.networking.limit import Limiter
        from netspectre.networking.monitor import BandwidthMonitor
        from netspectre.networking.watch import HostWatcher
        from netspectre.networking.utils import BitRate as _BitRate
        import netaddr

        # Resolve Default Interface and Gateway details
        interface = netutils.get_default_interface()
        if not interface:
            print("  ❌ Failed to resolve default network interface.")
            return False

        gateway_ip = netutils.get_default_gateway()
        if not gateway_ip:
            print("  ❌ Failed to resolve default gateway IP.")
            return False

        gateway_mac = netutils.get_mac_by_ip(interface, gateway_ip)
        if not gateway_mac:
            print("  ❌ Failed to resolve default gateway MAC.")
            return False

        netmask = netutils.get_default_netmask(interface)
        if not netmask:
            print("  ❌ Failed to resolve default netmask.")
            return False

        print(f"  ⚡ Real Network Interface: {interface}")
        print(f"  ⚡ Gateway IP: {gateway_ip} | MAC: {gateway_mac}")
        print(f"  ⚡ Netmask: {netmask}")

        # Initialize network rules (qdisc / ip forwarding)
        if not netutils.create_qdisc_root(interface):
            # Flush first in case it already exists
            netutils.flush_network_settings(interface)
            if not netutils.create_qdisc_root(interface):
                print("  ❌ Failed to create qdisc root handle. Try running with --flush.")
                return False

        if not netutils.enable_ip_forwarding():
            print("  ❌ Failed to enable IP forwarding.")
            return False

        iprange = list(netaddr.IPNetwork(f"{gateway_ip}/{netmask}"))

        # Initialize classes
        host_scanner = HostScanner(interface, iprange)
        arp_spoofer = ARPSpoofer(interface, gateway_ip, gateway_mac)
        limiter = Limiter(interface)
        bandwidth_monitor = BandwidthMonitor(interface, 1)
        host_watcher = HostWatcher(host_scanner, reconnect_callback)

        # Start Spoofer, Monitor, and Watcher threads
        arp_spoofer.start()
        bandwidth_monitor.start()
        host_watcher.start()

        network_settings = {
            "interface": interface,
            "gateway_ip": gateway_ip,
            "gateway_mac": gateway_mac,
            "netmask": netmask,
            "status": "running"
        }
        
        REAL_MODE = True
        print("  ✅ Real network mode successfully initialized!")
        return True

    except Exception as e:
        print(f"  ❌ Error initializing real network mode: {e}")
        return False

def reconnect_callback(old_host, new_host):
    """Callback for watched host reconnects — updates IP in hosts_list"""
    global hosts_list
    with hosts_lock:
        for i, h in enumerate(hosts_list):
            if h.mac == old_host.mac:
                hosts_list[i].ip = new_host.ip
                hosts_list[i].name = new_host.name
                break
    arp_spoofer.remove(old_host, restore=False)
    arp_spoofer.add(new_host)
    host_watcher.remove(old_host)
    host_watcher.add(new_host)
    limiter.replace(old_host, new_host)
    bandwidth_monitor.replace(old_host, new_host)
    _log("watch", f"Host reconnected: {old_host.ip} → {new_host.ip}")

# Bandwidth history tracking: mac -> list of {"time": str, "up": int, "down": int}
BANDWIDTH_HISTORY = {}

def get_hosts_dict_list():
    """Returns a list of dicts representing all currently known hosts (used by scheduler)"""
    res = []
    if REAL_MODE:
        with hosts_lock:
            for i, h in enumerate(hosts_list):
                res.append({"id": i, "mac": h.mac, "ip": h.ip})
    else:
        for h in DEMO_HOSTS:
            res.append({"id": h["id"], "mac": h["mac"], "ip": h["ip"]})
    return res

def scheduler_apply_limit(host_ids, rate_str):
    """Wrapper callback for scheduler limit actions"""
    from netspectre.networking.limit import Direction
    from netspectre.networking.utils import BitRate
    parsed_rate = BitRate.from_rate_string(rate_str)
    
    if REAL_MODE:
        with hosts_lock:
            for hid in host_ids:
                if hid < len(hosts_list):
                    host = hosts_list[hid]
                    arp_spoofer.add(host)
                    limiter.limit(host, Direction.BOTH, parsed_rate)
                    bandwidth_monitor.add(host)
                    setattr(host, 'limit_val', rate_str)
                    _log("limit", f"⏰ Scheduler limited {host.ip} to {rate_str}")
    else:
        for hid in host_ids:
            for host in DEMO_HOSTS:
                if host["id"] == hid:
                    host["status"] = "limited"
                    host["limit"] = rate_str
                    _log("limit", f"⏰ Scheduler limited {host['ip']} to {rate_str}")

def scheduler_apply_block(host_ids):
    """Wrapper callback for scheduler block actions"""
    from netspectre.networking.limit import Direction
    if REAL_MODE:
        with hosts_lock:
            for hid in host_ids:
                if hid < len(hosts_list):
                    host = hosts_list[hid]
                    arp_spoofer.add(host)
                    limiter.block(host, Direction.BOTH)
                    bandwidth_monitor.add(host)
                    _log("block", f"⏰ Scheduler blocked {host.ip}")
    else:
        for hid in host_ids:
            for host in DEMO_HOSTS:
                if host["id"] == hid:
                    host["status"] = "blocked"
                    host["upload"] = 0
                    host["download"] = 0
                    _log("block", f"⏰ Scheduler blocked {host['ip']}")

def scheduler_apply_free(host_ids):
    """Wrapper callback for scheduler release actions"""
    if REAL_MODE:
        with hosts_lock:
            for hid in host_ids:
                if hid < len(hosts_list):
                    host = hosts_list[hid]
                    free_host_by_obj(host)
                    _log("free", f"⏰ Scheduler freed {host.ip}")
    else:
        for hid in host_ids:
            for host in DEMO_HOSTS:
                if host["id"] == hid:
                    host["status"] = "free"
                    host["limit"] = None
                    _log("free", f"⏰ Scheduler freed {host['ip']}")

# ─── Background thread for real-time updates ──────────────────────────────────
def background_monitor():
    """Simulates or fetches real bandwidth metrics"""
    global hosts_list
    while True:
        time.sleep(1)
        updates = []
        now_time_str = datetime.now().strftime("%H:%M:%S")
        
        if REAL_MODE:
            with hosts_lock:
                for idx, host in enumerate(hosts_list):
                    res = bandwidth_monitor.get(host)
                    
                    # Convert to bytes/s
                    up = (res.upload_rate.rate // 8) if res else 0
                    down = (res.download_rate.rate // 8) if res else 0
                    
                    total_up = (res.upload_total_size.value / (1024 * 1024)) if res else 0
                    total_down = (res.download_total_size.value / (1024 * 1024)) if res else 0

                    mac_key = host.mac.lower()
                    if mac_key not in BANDWIDTH_HISTORY:
                        BANDWIDTH_HISTORY[mac_key] = []
                    BANDWIDTH_HISTORY[mac_key].append({"time": now_time_str, "up": up, "down": down})
                    if len(BANDWIDTH_HISTORY[mac_key]) > 20:
                        BANDWIDTH_HISTORY[mac_key].pop(0)

                    updates.append({
                        "id": idx,
                        "upload": up,
                        "download": down,
                        "total_up": round(total_up, 3),
                        "total_down": round(total_down, 3)
                    })
        else:
            # Demo Simulation mode
            for host in DEMO_HOSTS:
                if host["status"] == "blocked":
                    up, down = 0, 0
                elif host["status"] == "limited":
                    base = int(host["limit"].replace("mbit", "").replace("kbit", "")) * (1000 if "mbit" in str(host["limit"]) else 1)
                    up   = max(0, int(base * 0.1 + random.randint(-50, 50)))
                    down = max(0, int(base * 0.8 + random.randint(-200, 200)))
                else:
                    up   = max(0, host["upload"]   + random.randint(-100, 100))
                    down = max(0, host["download"]  + random.randint(-200, 300))

                host["upload"]   = up
                host["download"] = down
                host["total_up"]   = round(host["total_up"]   + up   / (1024 * 1024), 3)
                host["total_down"] = round(host["total_down"] + down / (1024 * 1024), 3)

                mac_key = host["mac"].lower()
                if mac_key not in BANDWIDTH_HISTORY:
                    BANDWIDTH_HISTORY[mac_key] = []
                BANDWIDTH_HISTORY[mac_key].append({"time": now_time_str, "up": up, "down": down})
                if len(BANDWIDTH_HISTORY[mac_key]) > 20:
                    BANDWIDTH_HISTORY[mac_key].pop(0)

                updates.append({
                    "id": host["id"],
                    "upload": up,
                    "download": down,
                    "total_up": host["total_up"],
                    "total_down": host["total_down"],
                })

        socketio.emit('bandwidth_update', {"hosts": updates})

# ─── REST API Endpoints ───────────────────────────────────────────────────────
@app.before_request
def check_auth():
    if request.path == '/' or not request.path.startswith('/api'):
        return None
    if request.path in ['/api/login', '/api/check-auth']:
        return None
    if request.method == 'OPTIONS':
        return None
        
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return jsonify({"status": "error", "message": "Unauthorized access"}), 401
    
    token = auth_header.split(" ")[1]
    if not config_manager.verify_token(token):
        return jsonify({"status": "error", "message": "Invalid session token"}), 401

@app.route('/')
def index():
    return send_from_directory('../frontend', 'index.html')

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json() or {}
    password = data.get("password", "")
    if config_manager.verify_password(password):
        token = config_manager.generate_token()
        return jsonify({"status": "ok", "token": token})
    return jsonify({"status": "error", "message": "Incorrect password"}), 401

@app.route('/api/check-auth', methods=['GET'])
def api_check_auth():
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        if config_manager.verify_token(token):
            return jsonify({"status": "ok", "authenticated": True})
    return jsonify({"status": "ok", "authenticated": False})

@app.route('/api/logout', methods=['POST'])
def api_logout():
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        config_manager.invalidate_token(token)
    return jsonify({"status": "ok"})

@app.route('/api/status')
def api_status():
    telegram_cfg = config_manager.config.get("telegram", {"enabled": False, "bot_token": "", "chat_id": ""})
    if REAL_MODE:
        total = len(hosts_list)
        blocked = sum(1 for h in hosts_list if h.blocked)
        limited = sum(1 for h in hosts_list if h.limited)
        free = total - blocked - limited
        return jsonify({
            "settings": network_settings,
            "stats": {
                "total": total,
                "blocked": blocked,
                "limited": limited,
                "free": free,
                "total_bw_up": 0,
                "total_bw_down": 0,
            },
            "telegram": telegram_cfg
        })
    else:
        # Demo Data
        total   = len(DEMO_HOSTS)
        blocked = sum(1 for h in DEMO_HOSTS if h["status"] == "blocked")
        limited = sum(1 for h in DEMO_HOSTS if h["status"] == "limited")
        free    = total - blocked - limited
        return jsonify({
            "settings": {
                "interface": "eth0 (DEMO MODE)",
                "gateway_ip": "192.168.1.1",
                "gateway_mac": "a4:91:b1:22:33:44",
                "netmask": "255.255.255.0",
                "status": "running"
            },
            "stats": {
                "total": total,
                "blocked": blocked,
                "limited": limited,
                "free": free,
                "total_bw_up": 0,
                "total_bw_down": 0,
            },
            "telegram": telegram_cfg
        })

@app.route('/api/hosts')
def api_hosts():
    if REAL_MODE:
        result = []
        with hosts_lock:
            for i, h in enumerate(hosts_list):
                mac_key = h.mac.lower()
                result.append({
                    "id": i,
                    "ip": h.ip,
                    "mac": h.mac,
                    "name": DEVICE_ALIASES.get(mac_key, h.name or "Unknown Host"),
                    "vendor": get_vendor(h.mac),
                    "type": get_device_type(h.name),
                    "status": "blocked" if h.blocked else "limited" if h.limited else "free",
                    "upload": 0,
                    "download": 0,
                    "total_up": 0,
                    "total_down": 0,
                    "limit": getattr(h, 'limit_val', None),
                    "watched": h.watched,
                    "history": BANDWIDTH_HISTORY.get(mac_key, [])
                })
        return jsonify({"hosts": result})
    else:
        # Resolve any saved aliases for demo hosts
        demo_resolved = []
        for h in DEMO_HOSTS:
            copied = dict(h)
            mac_key = h["mac"].lower()
            copied["name"] = DEVICE_ALIASES.get(mac_key, h["name"])
            copied["history"] = BANDWIDTH_HISTORY.get(mac_key, [])
            demo_resolved.append(copied)
        return jsonify({"hosts": demo_resolved})

@app.route('/api/alias', methods=['POST'])
def api_alias():
    data = request.get_json()
    mac = data.get("mac")
    alias_name = data.get("name")
    if not mac or alias_name is None:
        return jsonify({"status": "error", "message": "Missing mac or name"}), 400
    
    DEVICE_ALIASES[mac.lower()] = alias_name
    save_aliases()
    _log("settings", f"Set alias for {mac} to '{alias_name}'")
    return jsonify({"status": "ok"})

# Apply persistent static rules (limit, block) automatically
def apply_static_rules_for_hosts(hosts):
    static_rules = config_manager.config.get("static_rules", {})
    if not static_rules:
        return
    for h in hosts:
        mac = h.get("mac", "").lower()
        if mac in static_rules:
            rule = static_rules[mac]
            hid = h["id"]
            status = rule.get("status")
            limit_val = rule.get("limit", "1mbit")
            if status == "blocked":
                scheduler_apply_block([hid])
            elif status == "limited":
                scheduler_apply_limit([hid], limit_val)
            elif status == "free":
                scheduler_apply_free([hid])

@app.route('/api/scan', methods=['POST'])
def api_scan():
    """Run real scan or demo scan"""
    global hosts_list
    
    def run_real_scan():
        global hosts_list
        try:
            _log("scan", "Network scanning started...")
            scanned = host_scanner.scan()
            
            with hosts_lock:
                for h in hosts_list:
                    free_host_by_obj(h)
                hosts_list = scanned

            for h in hosts_list:
                arp_spoofer.add(h)
                bandwidth_monitor.add(h)

            result = []
            for i, h in enumerate(hosts_list):
                mac_key = h.mac.lower()
                result.append({
                    "id": i,
                    "ip": h.ip,
                    "mac": h.mac,
                    "name": DEVICE_ALIASES.get(mac_key, h.name or "Unknown Host"),
                    "vendor": get_vendor(h.mac),
                    "type": get_device_type(h.name),
                    "status": "free",
                    "upload": 0,
                    "download": 0,
                    "total_up": 0,
                    "total_down": 0,
                    "limit": None,
                    "watched": False
                })
            
            apply_static_rules_for_hosts(result)
            socketio.emit('scan_complete', {"count": len(hosts_list), "hosts": result})
            _log("scan", f"Scan complete. Discovered {len(hosts_list)} hosts.")
        except Exception as e:
            _log("scan", f"Scan failed: {e}")

    if REAL_MODE:
        threading.Thread(target=run_real_scan, daemon=True).start()
        return jsonify({"status": "scanning"})
    else:
        # Mock Scan
        def do_demo_scan():
            time.sleep(3)
            demo_resolved = []
            for h in DEMO_HOSTS:
                copied = dict(h)
                copied["name"] = DEVICE_ALIASES.get(h["mac"].lower(), h["name"])
                demo_resolved.append(copied)
            apply_static_rules_for_hosts(demo_resolved)
            socketio.emit('scan_complete', {"count": len(demo_resolved), "hosts": demo_resolved})
            _log("scan", f"Network scan complete — {len(demo_resolved)} hosts discovered")

        threading.Thread(target=do_demo_scan, daemon=True).start()
        _log("scan", "Network scan started (Demo Mode)...")
        return jsonify({"status": "scanning"})

@app.route('/api/limit', methods=['POST'])
def api_limit():
    from netspectre.networking.limit import Direction
    from netspectre.networking.utils import BitRate

    data = request.get_json()
    host_ids = data.get("ids", [])
    rate_str = data.get("rate", "1mbit")
    direction_str = data.get("direction", "both")

    direction = Direction.BOTH
    if direction_str == "upload":
        direction = Direction.OUTGOING
    elif direction_str == "download":
        direction = Direction.INCOMING

    parsed_rate = BitRate.from_rate_string(rate_str)

    if REAL_MODE:
        with hosts_lock:
            for hid in host_ids:
                if hid < len(hosts_list):
                    host = hosts_list[hid]
                    arp_spoofer.add(host)
                    limiter.limit(host, direction, parsed_rate)
                    bandwidth_monitor.add(host)
                    setattr(host, 'limit_val', rate_str)
                    _log("limit", f"Limited {host.ip} to {rate_str} ({direction_str})")
        return jsonify({"status": "ok", "affected": len(host_ids)})
    else:
        for hid in host_ids:
            for host in DEMO_HOSTS:
                if host["id"] == hid:
                    host["status"] = "limited"
                    host["limit"]  = rate_str
                    _log("limit", f"Limited {host['ip']} to {rate_str} ({direction_str})")
        return jsonify({"status": "ok", "affected": len(host_ids)})

@app.route('/api/block', methods=['POST'])
def api_block():
    from netspectre.networking.limit import Direction
    
    data = request.get_json()
    host_ids = data.get("ids", [])
    direction_str = data.get("direction", "both")

    direction = Direction.BOTH
    if direction_str == "upload":
        direction = Direction.OUTGOING
    elif direction_str == "download":
        direction = Direction.INCOMING

    if REAL_MODE:
        with hosts_lock:
            for hid in host_ids:
                if hid < len(hosts_list):
                    host = hosts_list[hid]
                    if not host.spoofed:
                        arp_spoofer.add(host)
                    limiter.block(host, direction)
                    bandwidth_monitor.add(host)
                    _log("block", f"Blocked traffic for {host.ip} ({direction_str})")
        return jsonify({"status": "ok", "affected": len(host_ids)})
    else:
        for hid in host_ids:
            for host in DEMO_HOSTS:
                if host["id"] == hid:
                    host["status"] = "blocked"
                    host["upload"] = 0
                    host["download"] = 0
                    _log("block", f"Blocked {host['ip']} - both directions")
        return jsonify({"status": "ok", "affected": len(host_ids)})

@app.route('/api/free', methods=['POST'])
def api_free():
    data = request.get_json()
    host_ids = data.get("ids", [])

    if REAL_MODE:
        with hosts_lock:
            for hid in host_ids:
                if hid < len(hosts_list):
                    host = hosts_list[hid]
                    free_host_by_obj(host)
                    _log("free", f"Freed {host.ip} - removed all limitations")
        return jsonify({"status": "ok", "affected": len(host_ids)})
    else:
        for hid in host_ids:
            for host in DEMO_HOSTS:
                if host["id"] == hid:
                    host["status"] = "free"
                    host["limit"]  = None
                    _log("free", f"Freed {host['ip']}")
        return jsonify({"status": "ok", "affected": len(host_ids)})

@app.route('/api/watch', methods=['POST'])
def api_watch():
    data = request.get_json()
    host_ids = data.get("ids", [])
    action = data.get("action", "add")

    if REAL_MODE:
        with hosts_lock:
            for hid in host_ids:
                if hid < len(hosts_list):
                    host = hosts_list[hid]
                    if action == "add":
                        host_watcher.add(host)
                    else:
                        host_watcher.remove(host)
                    _log("watch", f"{'Added' if action == 'add' else 'Removed'} {host.ip} {'to' if action == 'add' else 'from'} watch list")
        return jsonify({"status": "ok"})
    else:
        for hid in host_ids:
            for host in DEMO_HOSTS:
                if host["id"] == hid:
                    host["watched"] = (action == "add")
                    _log("watch", f"{'Added' if action == 'add' else 'Removed'} {host['ip']} watchlist")
        return jsonify({"status": "ok"})

@app.route('/api/rules', methods=['GET', 'POST'])
def api_rules():
    """Manage static rules"""
    if request.method == 'GET':
        return jsonify({"rules": config_manager.config.get("static_rules", {})})
    else:
        data = request.get_json() or {}
        mac = data.get("mac", "").lower()
        if not mac:
            return jsonify({"status": "error", "message": "Missing mac"}), 400
        
        status = data.get("status", "free")
        limit_val = data.get("limit", "1mbit")
        
        config_manager.config["static_rules"][mac] = {
            "status": status,
            "limit": limit_val
        }
        config_manager.save_config(config_manager.config)
        _log("settings", f"Saved persistent static rule for {mac} ({status})")
        return jsonify({"status": "ok"})

@app.route('/api/rules/delete', methods=['POST'])
def api_rules_delete():
    data = request.get_json() or {}
    mac = data.get("mac", "").lower()
    if mac in config_manager.config["static_rules"]:
        del config_manager.config["static_rules"][mac]
        config_manager.save_config(config_manager.config)
        _log("settings", f"Removed persistent static rule for {mac}")
        return jsonify({"status": "ok"})
    return jsonify({"status": "error", "message": "Rule not found"}), 404

@app.route('/api/scheduler', methods=['GET', 'POST'])
def api_scheduler():
    """Manage timed scheduler rules"""
    if request.method == 'GET':
        return jsonify({"scheduler": config_manager.config.get("scheduler", [])})
    else:
        import uuid
        data = request.get_json() or {}
        rule_id = data.get("id") or str(uuid.uuid4())
        
        rule = {
            "id": rule_id,
            "mac": data.get("mac", "").lower(),
            "action": data.get("action", "free"),
            "limit": data.get("limit", "1mbit"),
            "time_start": data.get("time_start", "22:00"),
            "time_end": data.get("time_end", "06:00"),
            "enabled": data.get("enabled", True)
        }
        
        # If edit, replace. Otherwise add.
        existing = config_manager.config["scheduler"]
        config_manager.config["scheduler"] = [r for r in existing if r.get("id") != rule_id]
        config_manager.config["scheduler"].append(rule)
        config_manager.save_config(config_manager.config)
        
        _log("settings", f"Updated scheduler rule for {rule['mac']}")
        return jsonify({"status": "ok", "rule": rule})

@app.route('/api/scheduler/delete', methods=['POST'])
def api_scheduler_delete():
    data = request.get_json() or {}
    rule_id = data.get("id")
    existing = config_manager.config["scheduler"]
    config_manager.config["scheduler"] = [r for r in existing if r.get("id") != rule_id]
    config_manager.save_config(config_manager.config)
    _log("settings", f"Deleted scheduler rule {rule_id}")
    return jsonify({"status": "ok"})

@app.route('/api/settings/telegram', methods=['POST'])
def api_settings_telegram():
    data = request.get_json() or {}
    config_manager.config["telegram"].update({
        "enabled": data.get("enabled", False),
        "bot_token": data.get("bot_token", ""),
        "chat_id": data.get("chat_id", "")
    })
    config_manager.save_config(config_manager.config)
    _log("settings", "Updated Telegram Bot notification parameters.")
    
    # Test sending Telegram message if enabled and credentials provided
    if data.get("enabled") and data.get("bot_token"):
        notifier.send_telegram_async(
            "🛡️ *NetSpectre Telegram Alert Service Enabled*\n\n"
            "This is a system verification message confirming that the NetSpectre Telegram notifications are successfully configured."
        )
    return jsonify({"status": "ok"})

@app.route('/api/settings/password', methods=['POST'])
def api_settings_password():
    data = request.get_json() or {}
    new_pwd = data.get("password", "")
    if not new_pwd:
        return jsonify({"status": "error", "message": "Password cannot be empty"}), 400
    config_manager.set_password(new_pwd)
    _log("settings", "Console master access password changed successfully.")
    return jsonify({"status": "ok"})

@app.route('/api/hosts/export')
def api_hosts_export():
    """Backup settings as JSON download"""
    backup = {
        "aliases": DEVICE_ALIASES,
        "static_rules": config_manager.config.get("static_rules", {}),
        "scheduler": config_manager.config.get("scheduler", []),
        "telegram": config_manager.config.get("telegram", {})
    }
    response = make_response(jsonify(backup))
    response.headers["Content-Disposition"] = "attachment; filename=netspectre_backup.json"
    return response

@app.route('/api/hosts/import', methods=['POST'])
def api_hosts_import():
    """Restore settings from JSON file"""
    global DEVICE_ALIASES
    if 'file' not in request.files:
        return jsonify({"status": "error", "message": "No file uploaded"}), 400
    file = request.files['file']
    try:
        data = json.load(file)
        if "aliases" in data:
            DEVICE_ALIASES.update(data["aliases"])
            save_aliases()
        if "static_rules" in data:
            config_manager.config["static_rules"].update(data["static_rules"])
        if "scheduler" in data:
            config_manager.config["scheduler"] = data["scheduler"]
        if "telegram" in data:
            config_manager.config["telegram"].update(data["telegram"])
            
        config_manager.save_config(config_manager.config)
        _log("settings", "Restored configurations from custom JSON backup.")
        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"status": "error", "message": f"Restore failed: {e}"}), 400

@app.route('/api/log')
def api_log():
    return jsonify({"log": ACTIVITY_LOG})

@app.route('/api/settings', methods=['POST'])
def api_settings():
    global network_settings
    data = request.get_json()
    if REAL_MODE:
        network_settings.update(data)
        _log("settings", "Network settings modified. Re-initialization recommended.")
        return jsonify({"status": "ok", "settings": network_settings})
    else:
        network_settings.update(data)
        return jsonify({"status": "ok", "settings": network_settings})

# ─── Cleanup helper ──────────────────────────────────────────────────────────
def free_host_by_obj(host):
    from netspectre.networking.limit import Direction
    if getattr(host, 'spoofed', False):
        arp_spoofer.remove(host)
    if limiter:
        limiter.unlimit(host, Direction.BOTH)
    if bandwidth_monitor:
        bandwidth_monitor.remove(host)
    if host_watcher:
        host_watcher.remove(host)
    if hasattr(host, 'limit_val'):
        delattr(host, 'limit_val')

# ─── MAIN RUNNER ──────────────────────────────────────────────────────────────
if __name__ == '__main__':
    load_aliases()
    initialize_real_network()

    ACTIVITY_LOG.append({"time": datetime.now().strftime("%H:%M:%S"), "type": "scan", "message": "NetSpectre Web Console initialized."})

    monitor_thread = threading.Thread(target=background_monitor, daemon=True)
    monitor_thread.start()

    # Start rule scheduler loop
    scheduler.start_scheduler(
        get_hosts_fn=get_hosts_dict_list,
        limit_fn=scheduler_apply_limit,
        block_fn=scheduler_apply_block,
        free_fn=scheduler_apply_free
    )

    print("\n  ███╗   ██╗███████╗████████╗███████╗██████╗ ███████╗ ██████╗████████╗██████╗ ███████╗")
    print("  ████╗  ██║██╔════╝╚══██╔══╝██╔════╝██╔══██╗██╔════╝██╔════╝╚══██╔══╝██╔══██╗██╔════╝")
    print("  ██╔██╗ ██║█████╗     ██║   ███████║██████╔╝█████╗  ██║        ██║   ██████╔╝█████╗  ")
    print("  ██║╚██╗██║██╔══╝     ██║   ╚════██║██╔═══╝ ██╔══╝  ██║        ██║   ██╔══██╗██╔══╝  ")
    print("  ██║ ╚████║███████╗   ██║   ███████║██║     ███████╗╚██████╗   ██║   ██║  ██║███████╗")
    print("  ╚═╝  ╚═══╝╚══════╝   ╚═╝   ╚══════╝╚═╝     ╚══════╝ ╚═════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝")
    print("\n  🌐  NetSpectre Web Console running at: http://localhost:5000")
    if REAL_MODE:
        print("  🟢  REAL MODE ACTIVE — interacting with network interface.")
    else:
        print("  ⚠️   DEMO MODE — using simulation data because backend was run without sudo/root.")
    print("")

    socketio.run(app, host='0.0.0.0', port=5000, debug=False, allow_unsafe_werkzeug=True)
