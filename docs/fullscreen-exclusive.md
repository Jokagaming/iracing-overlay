# Fullscreen Exclusive vs. Borderless Windowed

Diese App liegt als normales Windows-Fenster ueber iRacing. Das funktioniert
zuverlaessig, solange iRacing in **Borderless Windowed** laeuft — das ist
auch der von uns unterstuetzte und getestete Modus.

## Warum Fullscreen Exclusive nicht geht

Im echten Fullscreen-Exclusive-Modus uebernimmt die Anwendung selbst die
Grafikkarte und Windows haengt sich mit seinem Compositor (DWM) aus. Es gibt
in diesem Zustand keine Fensterverwaltung mehr, in die sich ein zweites
Fenster einklinken koennte — das betrifft nicht nur dieses Overlay, sondern
jedes andere Programm auch (Task-Leiste, Alt-Tab-Vorschau, Discord-Overlay,
NVIDIA-Overlay, ...). Das ist keine Einschraenkung von Electron oder dieser
App, sondern wie Windows in diesem Modus grundsaetzlich arbeitet.

Der einzige Weg, trotzdem ueber ein Fullscreen-Exclusive-Bild zu zeichnen,
waere ein Hook in die DirectX-Present-Aufrufe des Spiels selbst — eine
grundlegend andere, deutlich invasivere Technik (aehnlich einem Overlay wie
dem von Steam oder Discord), die hier bewusst nicht verfolgt wird.

## Praktischer Hinweis

iRacing hat gegenueber Borderless Windowed unter modernen Treibern keinen
spuerbaren Performance- oder Latenzvorteil mehr durch Fullscreen Exclusive.
Das ist auch der Grund, warum praktisch alle anderen Sim-Racing-Overlay-Tools
(RaceLab, Crew Chief, SimHub, ...) Borderless Windowed voraussetzen.

**Empfehlung:** iRacing-Grafikeinstellungen → Anzeigemodus → *Borderless
(randlos)* statt *Vollbild*.

## Geplante Absicherung in der App

Meilenstein 7 (Packaging) soll beim Start pruefen, ob iRacing im
Fullscreen-Exclusive-Modus laeuft, und in dem Fall einen Hinweis im
Tray-Menue anzeigen statt einfach nur ein unsichtbares Overlay zu zeigen.
