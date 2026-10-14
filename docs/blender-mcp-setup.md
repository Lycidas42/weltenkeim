# Blender + MCP einrichten (Windows)

Quelle: https://github.com/ahujasid/blender-mcp (offizielle Anleitung, dort im README)

## 1. Blender installieren

Blender **5.2 LTS** von https://www.blender.org/download/

## 2. uv installieren

In PowerShell:

```powershell
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

Danach PowerShell schließen und neu öffnen. Falls `uvx` nicht gefunden wird, den Ordner zum PATH hinzufügen:

```powershell
[Environment]::SetEnvironmentVariable("Path", [Environment]::GetEnvironmentVariable("Path","User") + ";$env:USERPROFILE\.local\bin", "User")
```

## 3. Blender-Add-on installieren

```powershell
uvx mcp-for-blender install-addon
```

Dann in Blender: **Bearbeiten → Einstellungen → Add-ons**, „Interface: MCP for Blender“ aktivieren.

Alternativ von Hand: `addon.py` aus dem GitHub-Repo herunterladen und in Blender unter Add-ons → Installieren auswählen.

## 4. MCP-Server bei Claude Code eintragen

Im Repo-Ordner (`C:\Entwicklung\Git\weltenkeim`):

```powershell
claude mcp add blender uvx mcp-for-blender
```

Falls später der Fehler `spawn uvx ENOENT` erscheint: `where uvx` ausführen und den vollen Pfad statt `uvx` eintragen.

## 5. Verbinden

1. Blender öffnen, im 3D-Viewport **N** drücken.
2. Reiter **MCP for Blender** öffnen, **Start MCP Server** klicken.
3. Eine **neue** Claude-Sitzung starten – erst dann kennt Claude die Blender-Werkzeuge.

Den `uvx mcp-for-blender`-Server nicht selbst im Terminal starten, das macht Claude.

## Sicherheit

- Der Server führt beliebigen Python-Code in Blender aus und hat keine Anmeldung. Nur lokal betreiben.
- Vor der Arbeit die Blender-Datei speichern.
- Anonyme Nutzungsstatistik abschalten: Umgebungsvariable `DISABLE_TELEMETRY=true` setzen.
