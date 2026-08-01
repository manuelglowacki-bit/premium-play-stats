import { useEffect, useState } from "react";

const TARGET = new Date("2026-08-21T20:45:00+02:00").getTime();

function read() {
  const remaining = Math.max(0, TARGET - Date.now());
  const pad = (n: number) => String(n).padStart(2, "0");
  return [
    { value: pad(Math.floor(remaining / 86400000)), label: "jours" },
    { value: pad(Math.floor(remaining / 3600000) % 24), label: "heures" },
    { value: pad(Math.floor(remaining / 60000) % 60), label: "min" },
    { value: pad(Math.floor(remaining / 1000) % 60), label: "sec" },
  ];
}

const placeholder = [
  { value: "--", label: "jours" },
  { value: "--", label: "heures" },
  { value: "--", label: "min" },
  { value: "--", label: "sec" },
];

export function Countdown() {
  const [units, setUnits] = useState(placeholder);

  useEffect(() => {
    setUnits(read());
    const t = window.setInterval(() => setUnits(read()), 1000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-4">
      {units.map((unit) => (
        <div
          key={unit.label}
          className="rounded-2xl border border-border bg-secondary/30 px-2 py-4 text-center"
        >
          <b className="block font-display text-3xl leading-none sm:text-4xl">{unit.value}</b>
          <span className="mt-1 block font-mono text-[10px] text-muted-foreground">
            {unit.label}
          </span>
        </div>
      ))}
    </div>
  );
}
