<p align="center"><img src="https://i.postimg.cc/9M14XsQ0/fg.png" alt="NetSpectre Banner" /></p>

# NetSpectre

NetSpectre is a high-performance network analysis and traffic shaping console designed for local network analysis. Utilizing advanced ARP redirection and Linux traffic control (tc) disciplines, NetSpectre allows administrators to monitor bandwidth, inspect node statistics, and throttle transmission rates (upload/download) across connected interfaces without needing administrative control on target hosts.

---
<style>
    .image-container {
        text-align: center;
        margin-bottom: 20px;
    }
    .zoom-img {
        width: 30%;
        max-width: 300px;
        margin: 5px;
        transition: transform 0.3s ease; /* تجعل التكبير ناعم وسلس */
    }
    .zoom-img:hover {
        transform: scale(1.2); /* تكبر الصورة بنسبة 20% عند تمرير الماوس */
        z-index: 10; /* تضمن ظهور الصورة المكبرة فوق بقية العناصر */
        position: relative;
    }
</style>

<div class="image-container">
    <a href="https://postimg.cc/S2TTNdtx" target="_blank"><img src="https://i.postimg.cc/S2TTNdtx/1.png" alt="1" class="zoom-img"></a>
    <a href="https://postimg.cc/HjnvPGVc" target="_blank"><img src="https://i.postimg.cc/HjnvPGVc/2.png" alt="2" class="zoom-img"></a>
    <a href="https://postimg.cc/ctvDK3V2" target="_blank"><img src="https://i.postimg.cc/ctvDK3V2/3.png" alt="3" class="zoom-img"></a>
</div>
 
---
             
## Key Features

- **Real-Time Web Panel**: Cyberpunk-themed real-time dashboard displaying host statuses, link consumption charts, and topology maps.
- **Granular Traffic Control**: Impose custom bandwidth limits or block internet connection altogether for specific nodes.
- **Host Watcher**: Automatically detects when monitored hosts reconnect with changed IP addresses.
- **Smart Rule Scheduler**: Schedule restrictions for specific devices (e.g. restrict speed during working hours).
- **Access Protection**: Built-in login authentication ensures only authorized users can manage the console.
- **SysAdmin Mail Notifications**: SMTP integration to alert you immediately on custom bandwidth threshold crossings or unknown hosts joining.
- **Host Details & Analytics**: Detailed graphs tracing device consumption history and vendor specifications.

---

## Requirements

- **Operating System**: Linux (Debian, Ubuntu, Kali Linux, Arch, etc.)
- **Python**: Python 3.8 or greater
- **Linux Core Tools**: `iptables`, `tc` (Traffic Control)

---

## Installation

To download and install NetSpectre globally:

```bash
git clone https://github.com/CyberSec1337/netspectre.git
cd netspectre
sudo python3 setup.py install
```

---

## Running the Web Console

To launch the web administration console:

```bash
cd web
sudo python3 backend/app.py
```
Open **`http://localhost:5000`** in your browser.

If launched without root privileges, NetSpectre automatically falls back to **Demo Mode** with simulated hosts, enabling design verification and API testing.

---

## CLI Interface Arguments

| Parameter | Action |
| --- | --- |
| `-i`, `--interface` | Specify physical network interface to bind (e.g. `eth0` or `wlan0`) |
| `-g`, `--gateway-ip` | IP address of network gateway |
| `-m`, `--gateway-mac` | Physical MAC address of gateway |
| `-n`, `--netmask` | Netmask for local subnet |
| `-f`, `--flush` | Resets and flushes local iptables rules and TC queue disciplines |

---

## Disclaimer
NetSpectre is provided for educational, testing, and network administration purposes only. The authors take no responsibility for misuse or damage caused by using this application.
