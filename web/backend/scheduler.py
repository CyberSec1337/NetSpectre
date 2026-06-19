import time
import threading
from datetime import datetime
from config_manager import config

# We will inject callback functions from app.py to apply limit/block/free
limit_callback = None
block_callback = None
free_callback = None
get_hosts_callback = None

def parse_time(t_str):
    try:
        return datetime.strptime(t_str.strip(), "%H:%M").time()
    except Exception:
        return None

def is_time_between(now_time, start_time, end_time):
    if start_time <= end_time:
        return start_time <= now_time <= end_time
    else:  # Over midnight, e.g. 22:00 to 06:00
        return now_time >= start_time or now_time <= end_time

def scheduler_loop():
    print("⏰ Timed Scheduler thread started.")
    # Track applied scheduler actions so we don't spam commands
    # mac -> last_applied_action_id
    applied_states = {}

    while True:
        time.sleep(10)
        
        schedules = config.get("scheduler", [])
        if not schedules:
            continue
            
        now_dt = datetime.now()
        now_time = now_dt.time()
        
        # Get active hosts list from app callback
        if not get_hosts_callback:
            continue
            
        active_hosts = get_hosts_callback() # list of dict representation of hosts
        
        for rule in schedules:
            if not rule.get("enabled", True):
                continue
                
            mac = rule.get("mac", "").lower()
            action = rule.get("action", "free")
            limit_val = rule.get("limit", "1mbit")
            t_start = parse_time(rule.get("time_start", ""))
            t_end = parse_time(rule.get("time_end", ""))
            
            if not mac or not t_start or not t_end:
                continue
                
            # Find the host index/id in active hosts matching mac
            target_host = None
            for h in active_hosts:
                if h.get("mac", "").lower() == mac:
                    target_host = h
                    break
                    
            if not target_host:
                continue
                
            host_id = target_host["id"]
            in_window = is_time_between(now_time, t_start, t_end)
            
            rule_key = f"{mac}_{rule.get('id')}"
            
            if in_window:
                # We are in the restriction window. Apply action.
                if applied_states.get(rule_key) != "applied":
                    applied_states[rule_key] = "applied"
                    if action == "block":
                        print(f"⏰ Scheduler: Blocking {mac} (time window active)")
                        if block_callback:
                            block_callback([host_id])
                    elif action == "limit":
                        print(f"⏰ Scheduler: Limiting {mac} to {limit_val} (time window active)")
                        if limit_callback:
                            limit_callback([host_id], limit_val)
            else:
                # We are outside the restriction window. Free host if it was applied.
                if applied_states.get(rule_key) == "applied":
                    applied_states[rule_key] = "released"
                    print(f"⏰ Scheduler: Releasing {mac} (time window ended)")
                    if free_callback:
                        free_callback([host_id])

def start_scheduler(get_hosts_fn, limit_fn, block_fn, free_fn):
    global get_hosts_callback, limit_callback, block_callback, free_callback
    get_hosts_callback = get_hosts_fn
    limit_callback = limit_fn
    block_callback = block_fn
    free_callback = free_fn
    
    t = threading.Thread(target=scheduler_loop, daemon=True)
    t.start()
