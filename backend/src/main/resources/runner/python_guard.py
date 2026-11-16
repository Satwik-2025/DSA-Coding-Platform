# Runs Main.py under an audit hook that refuses file writes, reads outside the standard library and
# the submission folder, network access, child processes and native-code loading. Audit hooks cannot
# be removed once installed. This is defence in depth for the local sandbox, not a hard boundary:
# the Docker sandbox (app.runner.sandbox=docker) is the strong isolation option.
import os
import sys

_work = os.path.realpath(os.path.dirname(os.path.abspath(sys.argv[1])))
_allowed_read = tuple({os.path.realpath(p) for p in (sys.prefix, sys.base_prefix, sys.exec_prefix, _work)})

_BLOCKED_EVENTS = (
    "socket.", "subprocess.", "os.system", "os.exec", "os.spawn", "os.posix_spawn", "os.fork",
    "os.kill", "os.remove", "os.unlink", "os.rename", "os.replace", "os.rmdir", "os.mkdir", "os.chmod",
    "os.chown", "os.truncate", "os.link", "os.symlink", "os.putenv", "os.unsetenv", "os.startfile",
    "shutil.", "ctypes.", "winreg.", "_winapi.", "msvcrt.", "webbrowser.", "urllib.", "http.client.",
    "ftplib.", "smtplib.", "poplib.", "imaplib.", "telnetlib.", "sqlite3.",
)
_BLOCKED_MODULES = {
    "ctypes", "_ctypes", "socket", "_socket", "ssl", "_ssl", "subprocess", "_posixsubprocess",
    "multiprocessing", "_multiprocessing", "_winapi", "winreg", "msvcrt", "signal", "pty", "fcntl",
    "resource", "mmap", "asyncio", "selectors", "select", "urllib", "http", "sqlite3",
}


def _hook(event, args):
    if event == "open":
        path, mode = args[0], args[1]
        if isinstance(path, int):
            return  # already-open descriptors such as stdin / stdout
        writing = mode is not None and any(c in str(mode) for c in "wax+")
        real = os.path.realpath(os.fsdecode(path))
        if writing or not real.startswith(_allowed_read):
            raise PermissionError("Blocked by the sandbox: file access is not allowed")
        return
    if event == "import" and args[0].split(".")[0] in _BLOCKED_MODULES:
        raise ImportError(f"Blocked by the sandbox: module '{args[0]}' is not allowed")
    if event.startswith(_BLOCKED_EVENTS):
        raise PermissionError(f"Blocked by the sandbox: {event} is not allowed")


sys.addaudithook(_hook)

import runpy  # noqa: E402  (imported after the hook so it is covered too)

sys.argv = sys.argv[1:]
runpy.run_path(sys.argv[0], run_name="__main__")
