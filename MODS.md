# Installierte Mods

Stand: 2026-10-12. Alle mit Scope `user` installiert und aktiv.

| Mod | Version | Marketplace | Quelle | Was er macht |
| --- | --- | --- | --- | --- |
| `token-weather` | 0.1.0 | `my-mods` | dieses Repo (`./token-weather`) | Live-Vorhersage des Kontextfensters über dem Prompt |
| `next-steps` | 1.0.0 | `my-mods` | dieses Repo (`./next-steps`) | Schlägt nach jedem Turn bis zu drei nächste Prompts vor (Tasten 1–3, 0 verwirft) |
| `blast-radius` | 0.1.0 | `my-mods` | dieses Repo (`./blast-radius`) | Hält riskante Shell-Befehle an und zeigt, was sie ändern würden (Proceed/Cancel). Fragt nur, wenn etwas verloren ginge |
| `replay-theater` | 0.1.0 | `claude-code-playground-mods` | [anthropics/claude-code-playground](https://github.com/anthropics/claude-code-playground/tree/main/claude-code/mods/replay-theater) | Datei-Edits des letzten Turns Diff für Diff durchgehen |
| `savvy-progress` | 1.2.0 | `claude-kit` | [JohnnyVizz/claude-kit](https://github.com/JohnnyVizz/claude-kit/tree/main/plugins/savvy-progress) | Fortschrittsbalken über dem Prompt und Agents-Panel (`/agents-info`) |
| `skins` | 0.5.3 | `hellosverre-mods` | [hellosverre/claude-skins](https://github.com/hellosverre/claude-skins) | Tool-Zeilen mit Icons, Diff-/Tabellen-/Mermaid-Karten, Usage-Band, 15 Themes (`/skin`) |
| `filetree` | 0.2.24 | `claude-code-filetree` | [data-goblin/claude-code-filetree](https://github.com/data-goblin/claude-code-filetree) | IDE-Dateibaum mit Git-Status und Markierung der Dateien, die Claude anfasst |
| `cache-tax` | 2.2.1 | `claude-code-mods` | [karanb192/claude-code-mods](https://github.com/karanb192/claude-code-mods) ([Projekt](https://github.com/karanb192/cache-tax)) | Hält den Prompt-Cache in Pausen warm (`/keepwarm`), stoppt kalte Sends einmal mit Kostenschätzung. Warm-Pings kosten Tokens |
| `reflect-mod` | 3.3.0 | `claude-reflect-marketplace` | [BayramAnnakov/claude-reflect](https://github.com/BayramAnnakov/claude-reflect) | Erkennt Korrekturen in Prompts und speichert sie per Band in CLAUDE.md |
| `terminal-browser` | 0.0.2 | `terminal-browser` | [zenbu-labs/terminal-browser](https://github.com/zenbu-labs/terminal-browser) | Browser im Terminal. Braucht das Programm `terminal-browser` (`~/.local/bin`) und ein Terminal mit Kitty-Grafik |
| `plan-progress` | 0.8.2 | `zycck-mods` | [zycck/claude-mods](https://github.com/zycck/claude-mods) | Live-Plan-Fortschrittsbalken über dem Prompt mit Sounds |

## Hinweise

- `replay-theater`: Der Marketplace liegt in einem Unterordner, deshalb lokal geklont nach
  `~/.claude/plugins/local/claude-code-playground` (sparse, `claude-code/mods`). Update: `git pull` dort.
- `blast-radius` kommt aus diesem Repo, nicht aus dem Playground: Die eigene Version hat den gründlicheren
  Parser und fragt nur bei Datenverlust.
- Gesetzte Optionen: `savvy-progress` → `language: en` (Deutsch gibt es nicht), `terminal-browser` → `agentTool`.

## Neu installieren

```sh
claude plugin marketplace add /home/degoya/projects/my-mods
claude plugin marketplace add johnnyvizz/claude-kit
claude plugin marketplace add hellosverre/claude-skins
claude plugin marketplace add data-goblin/claude-code-filetree
claude plugin marketplace add karanb192/claude-code-mods
claude plugin marketplace add BayramAnnakov/claude-reflect
claude plugin marketplace add zenbu-labs/terminal-browser
claude plugin marketplace add zycck/claude-mods
git clone --filter=blob:none --sparse https://github.com/anthropics/claude-code-playground ~/.claude/plugins/local/claude-code-playground
git -C ~/.claude/plugins/local/claude-code-playground sparse-checkout set claude-code/mods
claude plugin marketplace add ~/.claude/plugins/local/claude-code-playground/claude-code/mods

claude plugin install token-weather@my-mods
claude plugin install next-steps@my-mods
claude plugin install blast-radius@my-mods
claude plugin install replay-theater@claude-code-playground-mods
claude plugin install savvy-progress@claude-kit
claude plugin install skins@hellosverre-mods
claude plugin install filetree@claude-code-filetree
claude plugin install cache-tax@claude-code-mods
claude plugin install reflect-mod@claude-reflect-marketplace
claude plugin install terminal-browser@terminal-browser
claude plugin install plan-progress@zycck-mods

# Programm für terminal-browser
curl -fsSL https://terminal-browser.sh/install | bash
```
