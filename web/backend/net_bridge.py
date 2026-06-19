"""
EvilLimiter Network Bridge
Imports core networking modules cleanly without CLI dependencies
"""
import sys
import os

# Add evillimiter to path
NETSPECTRE_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
sys.path.insert(0, NETSPECTRE_PATH)

# Pre-initialize IO to avoid circular import issues
import colorama
colorama.init(autoreset=True)

# Now import networking modules
import netspectre.networking.utils as netutils
from netspectre.networking.host import Host
from netspectre.networking.scan import HostScanner
from netspectre.networking.spoof import ARPSpoofer
from netspectre.networking.limit import Limiter, Direction
from netspectre.networking.monitor import BandwidthMonitor
from netspectre.networking.watch import HostWatcher
from netspectre.networking.utils import BitRate

__all__ = [
    'netutils', 'Host', 'HostScanner', 'ARPSpoofer',
    'Limiter', 'Direction', 'BandwidthMonitor', 'HostWatcher', 'BitRate'
]
