"""System introspection: cpu, memory, disk, processes, network."""

from __future__ import annotations

import platform
import shutil


def system_info() -> dict:
    import psutil

    cpu_pct = psutil.cpu_percent(interval=0.2)
    mem = psutil.virtual_memory()
    disk = shutil.disk_usage("/")
    return {
        "os":               platform.platform(),
        "python":           platform.python_version(),
        "cpu_percent":      cpu_pct,
        "cpu_count":        psutil.cpu_count(),
        "load_avg":         list(getattr(psutil, "getloadavg", lambda: (0, 0, 0))()),
        "memory_total_gb":  round(mem.total / 1e9, 2),
        "memory_used_gb":   round(mem.used / 1e9, 2),
        "memory_percent":   mem.percent,
        "disk_total_gb":    round(disk.total / 1e9, 2),
        "disk_free_gb":     round(disk.free / 1e9, 2),
    }


def processes(top_n: int = 20, sort_by: str = "cpu") -> dict:
    import psutil

    procs = []
    for p in psutil.process_iter(["pid", "name", "username", "cpu_percent", "memory_percent"]):
        try:
            procs.append(p.info)
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    key = "cpu_percent" if sort_by == "cpu" else "memory_percent"
    procs.sort(key=lambda x: x.get(key) or 0, reverse=True)
    return {"sorted_by": sort_by, "count": len(procs), "top": procs[:top_n]}


def network() -> dict:
    import psutil

    out: dict[str, list] = {}
    for iface, addrs in psutil.net_if_addrs().items():
        out[iface] = [{"family": str(a.family), "address": a.address} for a in addrs]
    counters = {k: v._asdict() for k, v in psutil.net_io_counters(pernic=True).items()}
    return {"interfaces": out, "io_counters": counters}


SYS_SCHEMA = {
    "type": "function",
    "function": {
        "name": "system_info",
        "description": "Get host OS, CPU, memory, disk, and load info.",
        "parameters": {"type": "object", "properties": {}},
    },
}

PROC_SCHEMA = {
    "type": "function",
    "function": {
        "name": "processes",
        "description": "List top running processes by cpu or memory.",
        "parameters": {
            "type": "object",
            "properties": {
                "top_n":   {"type": "integer", "default": 20},
                "sort_by": {"type": "string", "enum": ["cpu", "memory"], "default": "cpu"},
            },
        },
    },
}

NET_SCHEMA = {
    "type": "function",
    "function": {
        "name": "network",
        "description": "List network interfaces, addresses, and per-NIC IO counters.",
        "parameters": {"type": "object", "properties": {}},
    },
}
