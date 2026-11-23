import subprocess
import re

files = subprocess.check_output(['git', 'ls-files'], text=True).splitlines()
patterns = [
    ("Postgres URI with password", re.compile(r'postgres(?:ql)?://[^\s:]+:[^\s@]+@')),
    ("Hardcoded Secret Key", re.compile(r'secret[_\-]?key\s*=\s*[\'"][0-9a-zA-Z\-_]{16,}')),
    ("Developer Email", re.compile(r'bhoraniyadevendra@gmail\.com', re.I)),
    ("Google API Key", re.compile(r'AIza[0-9A-Za-z\-_]{35}')),
]

findings = []
for f in files:
    if f.endswith(('.py', '.ts', '.tsx', '.json', '.env.example', '.yml', '.yaml', '.md', '.html')):
        try:
            with open(f, 'r', encoding='utf-8', errors='ignore') as fp:
                for idx, line in enumerate(fp, 1):
                    for label, pat in patterns:
                        if pat.search(line):
                            findings.append((label, f, idx, line.strip()))
        except Exception:
            pass

print(f"Total secret scanner findings: {len(findings)}")
for label, file, line_no, content in findings:
    print(f"[{label}] {file}:{line_no} -> {content[:80]}")
