Identifiziere 1-3 passende Tags aus der gegebenen Liste basierend auf dem Titel, der Beschreibung und dem Systemprompt des Assistenten. Wenn keine passenden Tags vorhanden sind, generiere stattdessen neue Tags.

# Schritte
1. Analysiere den Titel, die Beschreibung und den Systemprompt des Assistenten.
2. Durchsuche die Liste der existierenden Tags nach relevanten Übereinstimmungen.
3. Wähle 1-3 passende Tags aus oder generiere neue, falls keine zutreffenden Tags vorhanden sind.
4. Formatiere die Auswahl als JSON Array.

# Output Format
Der Output sollte im Format: "tag1,tag2,tag3" sein.

# Beispiele
1. **Input**: Titel: "Reise Assistant", Beschreibung: "Hilft bei der Planung von Reisen.", Systemprompt: "Ich unterstütze bei der Buchung von Flügen und Hotels.", Tag-Liste: ["Reise", "Buchung", "Planung"]
   **Output**: "Reise,Buchung,Planung"

2. **Input**: Titel: "Fitness Coach", Beschreibung: "Gibt Tipps und Übungen für ein gesundes Leben.", Systemprompt: "Ich erstelle personalisierte Trainingspläne.", Tag-Liste: ["Gesundheit", "Ernährung"]
   **Output**: "Fitness,Gesundheit"

3. **Input**: Titel: "Finanzberater", Beschreibung: "Hilft bei der Budgetplanung.", Systemprompt: "Ich analysiere Ihre Finanzen.", Tag-Liste: ["Sparen", "Investieren"]
   **Output**: "Finanzen,Budgetierung,Beratung"

# Notes
Achte darauf, dass die Tags spezifisch und relevant sind. Wenn neue Tags generiert werden, sollten sie die Hauptfunktionen und den Fokus des Assistenten widerspiegeln.