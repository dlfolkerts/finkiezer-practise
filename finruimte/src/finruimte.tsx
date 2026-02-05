// FinruimteMVP.tsx
// Minimal React MVP (single file) — multi-step flow + harde uitsluitingen + A/B/C uitkomst.
// Doel: lokaal testen van afrondingsratio, uitkomstverdeling, en gedrag na resultaat.
// Geen accounts, geen opslag naar server. Alleen console + localStorage events.
//
// Gebruik:
// - Plaats dit bestand in een React/Vite project (src/FinruimteMVP.tsx)
// - Render <FinruimteMVP /> in App.tsx
//
// Aannames (hypothese):
// - 5–6 schermen maximaliseert completion.
// - Bands (omzet, bestaande financiering) reduceert invoerfrictie.
// - Range output + onzekerheidsfactoren voorkomt "adviesclaim".

import React, { useEffect, useMemo, useState } from "react";

type Rechtsvorm = "eenmanszaak" | "bv";
type OmzetBand = "50-100" | "100-250" | "250-1000" | "1000+";
type Winst = "verlies" | "breakeven" | "winst";
type BestaandeFin = "nee" | "<50" | "50+";
type Doel = "werkkapitaal" | "investering" | "herfinanciering";
type Borg = "ja" | "nee";

type Answers = {
  rechtsvorm?: Rechtsvorm;
  actief12m?: "ja" | "nee";
  omzet?: OmzetBand;
  winst?: Winst;
  bestaandeFin?: BestaandeFin;
  doel?: Doel;
  borg?: Borg;
};

type Eligibility =
  | { kind: "ok" }
  | { kind: "exit"; reason: string; detail: string };

type OutcomeBucket = "A" | "B" | "C";

type Outcome = {
  bucket: OutcomeBucket;
  rangeEur: [number, number] | null; // null bij exit
  assumptions: string[];
  sensitivities: string[];
  notMeaning: string[];
  suggestedNext: {
    key: "vergelijken" | "meer_uitleg" | "advies";
    label: string;
    note: string;
  }[];
};

type EventType =
  | "session_start"
  | "step_view"
  | "step_submit"
  | "exit"
  | "result_view"
  | "result_action";

type EventRecord = {
  ts: number;
  sessionId: string;
  type: EventType;
  payload?: Record<string, any>;
};

function uid(): string {
  // voldoende voor lokale tests
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}

function euro(n: number): string {
  return n.toLocaleString("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

// -------------------- Logica: eligibility + outcome --------------------

function checkEligibility(a: Answers): Eligibility {
  // Feit (scope): geen starters, min 12m actief, min €50k omzet (banden starten bij 50k)
  if (a.actief12m === "nee") {
    return {
      kind: "exit",
      reason: "Niet binnen MVP-scope",
      detail:
        "Deze tool is bedoeld voor ondernemingen die minimaal 12 maanden actief zijn.",
    };
  }
  // Omzetband start bij 50k, dus leeg = nog niet beantwoord; niet afwijzen hier.
  // Rechtsvorm: eenmanszaak/BV ok.
  return { kind: "ok" };
}

function baseRange(omzet?: OmzetBand): [number, number] {
  // Hypothese: ruwe bandbreedtes die logisch oplopen met omzet.
  // Dit is niet “waar”, maar consistent en testbaar voor UX en routing.
  switch (omzet) {
    case "50-100":
      return [15_000, 50_000];
    case "100-250":
      return [30_000, 120_000];
    case "250-1000":
      return [75_000, 350_000];
    case "1000+":
      return [150_000, 750_000];
    default:
      return [0, 0];
  }
}

function adjustRange(
  r: [number, number],
  winst?: Winst,
  bestaandeFin?: BestaandeFin,
  borg?: Borg,
  doel?: Doel,
): [number, number] {
  let [lo, hi] = r;

  // Winstgevendheid
  if (winst === "verlies") {
    lo *= 0.3;
    hi *= 0.6;
  } else if (winst === "breakeven") {
    lo *= 0.6;
    hi *= 0.85;
  } else if (winst === "winst") {
    lo *= 1.0;
    hi *= 1.05;
  }

  // Bestaande financiering = draagkracht / leverage
  if (bestaandeFin === "50+") {
    lo *= 0.5;
    hi *= 0.7;
  } else if (bestaandeFin === "<50") {
    lo *= 0.8;
    hi *= 0.9;
  }

  // Privé-borg
  if (borg === "nee") {
    lo *= 0.85;
    hi *= 0.9;
  } else if (borg === "ja") {
    lo *= 1.05;
    hi *= 1.1;
  }

  // Doel: herfinanciering vaak afhankelijker; investering soms hoger plafond.
  if (doel === "herfinanciering") {
    lo *= 0.8;
    hi *= 0.9;
  } else if (doel === "investering") {
    lo *= 1.0;
    hi *= 1.05;
  } else if (doel === "werkkapitaal") {
    lo *= 1.0;
    hi *= 1.0;
  }

  lo = clamp(Math.round(lo / 1000) * 1000, 0, 2_000_000);
  hi = clamp(Math.round(hi / 1000) * 1000, 0, 2_000_000);

  if (hi < lo) hi = lo;

  return [lo, hi];
}

function bucketize(a: Answers, range: [number, number]): OutcomeBucket {
  // Hypothese: eenvoudig heuristisch bucketschema.
  // A = waarschijnlijk ruimte, B = onzeker/afhankelijk, C = waarschijnlijk beperkt.
  const [lo, hi] = range;

  const loss = a.winst === "verlies";
  const heavyDebt = a.bestaandeFin === "50+";
  const noBorg = a.borg === "nee";
  const lowOmzet = a.omzet === "50-100";

  const riskFlags = [loss, heavyDebt, noBorg].filter(Boolean).length;

  if (lo === 0 && hi === 0) return "B";

  if (loss && (heavyDebt || lowOmzet)) return "C";
  if (riskFlags >= 2) return "B";
  if (!loss && !heavyDebt && hi >= 90_000) return "A";
  if (lowOmzet && !loss && !heavyDebt) return "B";

  // default
  return "B";
}

function buildOutcome(a: Answers): {
  eligibility: Eligibility;
  outcome?: Outcome;
} {
  const elig = checkEligibility(a);
  if (elig.kind === "exit") {
    return {
      eligibility: elig,
      outcome: {
        bucket: "C",
        rangeEur: null,
        assumptions: [
          "Je onderneming is korter dan 12 maanden actief (buiten MVP-scope).",
          "Deze tool geeft alleen bandbreedtes voor ondernemingen met minimale historie.",
        ],
        sensitivities: [
          "Activiteitsduur",
          "Beschikbaarheid van omzet- en betaaldata",
        ],
        notMeaning: ["Geen kredietgoedkeuring", "Geen advies of garantie"],
        suggestedNext: [
          {
            key: "meer_uitleg",
            label: "Meer uitleg",
            note: "Waarom 12 maanden historie in veel modellen een harde grens is.",
          },
        ],
      },
    };
  }

  const br = baseRange(a.omzet);
  const adj = adjustRange(br, a.winst, a.bestaandeFin, a.borg, a.doel);
  const bucket = bucketize(a, adj);

  const assumptions: string[] = [
    "Bandbreedte is gebaseerd op omzetbanden en grove risicofactoren, niet op volledige jaarrekeningen.",
    "Er is geen rekening gehouden met sector, zekerheden, debiteurenkwaliteit of PSP-data.",
    "Uitkomst veronderstelt dat de onderneming operationeel stabiel is en geen verborgen betalingsachterstanden heeft.",
  ];

  const sensitivities: string[] = [];
  if (a.winst !== "winst")
    sensitivities.push("Winstgevendheid (marge, kasstroom)");
  if (a.bestaandeFin !== "nee")
    sensitivities.push("Bestaande financieringslasten");
  if (a.borg === "nee")
    sensitivities.push("Beschikbaarheid van borg/zekerheden");
  if (a.doel === "herfinanciering")
    sensitivities.push("Documentatie en voorwaarden bestaande financiering");
  if (sensitivities.length === 0)
    sensitivities.push("Kwaliteit van financiële informatie");

  const notMeaning = [
    "Geen kredietgoedkeuring of garantie",
    "Geen rente-indicatie of offerte",
    "Geen financieel of juridisch advies",
  ];

  const suggestedNext =
    bucket === "A"
      ? [
          {
            key: "vergelijken",
            label: "Zelf verdiepen / vergelijken",
            note: "Als de situatie eenvoudig is en fouten omkeerbaar.",
          },
          {
            key: "meer_uitleg",
            label: "Meer uitleg",
            note: "Welke factoren financiers meestal aanvullend toetsen.",
          },
        ]
      : bucket === "B"
        ? [
            {
              key: "meer_uitleg",
              label: "Meer uitleg",
              note: "Welke variabelen de bandbreedte het meest verschuiven.",
            },
            {
              key: "advies",
              label: "Advies bij complexiteit",
              note: "Als de structuur/lasten complex zijn of fouten duur zijn.",
            },
          ]
        : [
            {
              key: "meer_uitleg",
              label: "Meer uitleg",
              note: "Wat vaak nodig is om haalbaarheid te verbeteren.",
            },
            {
              key: "advies",
              label: "Advies bij complexiteit",
              note: "Als er herstructurering of maatwerk nodig is.",
            },
          ];

  return {
    eligibility: elig,
    outcome: {
      bucket,
      rangeEur: adj,
      assumptions,
      sensitivities,
      notMeaning,
      suggestedNext: suggestedNext as {
        key: "vergelijken" | "meer_uitleg" | "advies";
        label: string;
        note: string;
      }[],
    },
  };
}

// -------------------- UI --------------------

type StepId = "start" | "scope" | "finance" | "goal" | "review" | "result";

const stepOrder: StepId[] = [
  "start",
  "scope",
  "finance",
  "goal",
  "review",
  "result",
];

function StepShell(props: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  footerNote?: string;
}) {
  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div>
          <div style={styles.title}>{props.title}</div>
          {props.subtitle ? (
            <div style={styles.subtitle}>{props.subtitle}</div>
          ) : null}
        </div>
      </div>

      <div style={styles.body}>{props.children}</div>

      <div style={styles.footer}>
        <div style={{ display: "flex", gap: 8 }}>
          {props.onBack ? (
            <button style={styles.btnSecondary} onClick={props.onBack}>
              Terug
            </button>
          ) : null}
          {props.onNext ? (
            <button
              style={styles.btnPrimary}
              onClick={props.onNext}
              disabled={props.nextDisabled}
            >
              {props.nextLabel ?? "Volgende"}
            </button>
          ) : null}
        </div>
        {props.footerNote ? (
          <div style={styles.footnote}>{props.footerNote}</div>
        ) : null}
      </div>
    </div>
  );
}

function RadioRow<T extends string>(props: {
  label: string;
  value?: T;
  setValue: (v: T) => void;
  options: { value: T; label: string; hint?: string }[];
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={styles.fieldLabel}>{props.label}</div>
      <div style={{ display: "grid", gap: 8 }}>
        {props.options.map((o) => (
          <label key={o.value} style={styles.option}>
            <input
              type="radio"
              name={props.label}
              checked={props.value === o.value}
              onChange={() => props.setValue(o.value)}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{ fontWeight: 600 }}>{o.label}</div>
              {o.hint ? <div style={styles.hint}>{o.hint}</div> : null}
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

function Pill(props: { text: string }) {
  return <span style={styles.pill}>{props.text}</span>;
}

export default function FinruimteMVP() {
  const [sessionId] = useState<string>(() => uid());
  const [step, setStep] = useState<StepId>("start");
  const [answers, setAnswers] = useState<Answers>({});
  const [result, setResult] = useState<Outcome | null>(null);
  const [exitInfo, setExitInfo] = useState<Eligibility | null>(null);

  const stepIndex = stepOrder.indexOf(step);

  const log = (type: EventType, payload?: Record<string, any>) => {
    const rec: EventRecord = { ts: Date.now(), sessionId, type, payload };
    // console is voldoende voor MVP-validatie
    console.log("[Finruimte]", rec);
    try {
      const key = "finruimte_mvp_events";
      const prev = JSON.parse(
        localStorage.getItem(key) || "[]",
      ) as EventRecord[];
      prev.push(rec);
      localStorage.setItem(key, JSON.stringify(prev.slice(-2000)));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    log("session_start", { ua: navigator.userAgent });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    log("step_view", { step });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const canProceed = useMemo(() => {
    if (step === "scope")
      return Boolean(answers.rechtsvorm && answers.actief12m && answers.omzet);
    if (step === "finance")
      return Boolean(answers.winst && answers.bestaandeFin);
    if (step === "goal") return Boolean(answers.doel && answers.borg);
    return true;
  }, [answers, step]);

  const goNext = () => {
    log("step_submit", { step, answers });
    const idx = stepOrder.indexOf(step);
    const next = stepOrder[Math.min(idx + 1, stepOrder.length - 1)];
    setStep(next);
  };

  const goBack = () => {
    const idx = stepOrder.indexOf(step);
    const prev = stepOrder[Math.max(idx - 1, 0)];
    setStep(prev);
  };

  const compute = () => {
    const { eligibility, outcome } = buildOutcome(answers);
    setExitInfo(eligibility);
    setResult(outcome ?? null);
    log("result_view", { eligibility, outcome });
    setStep("result");
  };

  const reset = () => {
    setAnswers({});
    setResult(null);
    setExitInfo(null);
    setStep("start");
  };

  // ---- Render per stap ----

  const topBar = (
    <div style={styles.topbar}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={styles.brand}>Finruimte (MVP)</div>
        <Pill text={`Stap ${stepIndex + 1} / ${stepOrder.length}`} />
      </div>
      <div style={styles.topbarRight}>
        <button
          style={styles.btnTertiary}
          onClick={() => {
            try {
              const key = "finruimte_mvp_events";
              const raw = localStorage.getItem(key) || "[]";
              navigator.clipboard?.writeText(raw);
              alert("Events gekopieerd naar clipboard (JSON).");
            } catch {
              alert("Kon events niet kopiëren. Check console/localStorage.");
            }
          }}
          title="Kopieer lokale events (JSON) uit localStorage"
        >
          Exporteer events
        </button>
        <button
          style={styles.btnTertiary}
          onClick={() => {
            localStorage.removeItem("finruimte_mvp_events");
            alert("Lokale events verwijderd.");
          }}
        >
          Wis events
        </button>
      </div>
    </div>
  );

  return (
    <div style={styles.page}>
      {topBar}

      <div style={styles.container}>
        {step === "start" ? (
          <StepShell
            title="Zakelijke financieringsruimte — globale bandbreedte"
            subtitle="Deze tool toont een bandbreedte op basis van grove aannames. Geen aanvraag, geen advies, geen garantie."
            onNext={goNext}
            nextLabel="Start"
            footerNote="MVP: één use case, één flow. Doel is afronding en leerdata."
          >
            <ul style={styles.ul}>
              <li style={styles.li}>
                Je krijgt een range (min–max), plus de belangrijkste
                onzekerheden.
              </li>
              <li style={styles.li}>
                We tonen geen aanbieders, rentes of looptijden.
              </li>
              <li style={styles.li}>
                Buiten scope: starters (&lt;12 maanden actief).
              </li>
            </ul>
          </StepShell>
        ) : null}

        {step === "scope" ? (
          <StepShell
            title="Scope-check"
            subtitle="We beperken de tool bewust tot één duidelijke doelgroep."
            onBack={goBack}
            onNext={goNext}
            nextDisabled={!canProceed}
            footerNote="Als je buiten scope valt, tonen we dat direct en transparant."
          >
            <RadioRow<Rechtsvorm>
              label="Rechtsvorm"
              value={answers.rechtsvorm}
              setValue={(v) => setAnswers((s) => ({ ...s, rechtsvorm: v }))}
              options={[
                { value: "eenmanszaak", label: "Eenmanszaak" },
                { value: "bv", label: "BV" },
              ]}
            />
            <RadioRow<"ja" | "nee">
              label="Minimaal 12 maanden actief?"
              value={answers.actief12m}
              setValue={(v) => setAnswers((s) => ({ ...s, actief12m: v }))}
              options={[
                { value: "ja", label: "Ja" },
                {
                  value: "nee",
                  label: "Nee",
                  hint: "Buiten MVP-scope: we geven dan geen bandbreedte.",
                },
              ]}
            />
            <RadioRow<OmzetBand>
              label="Jaaromzet (band)"
              value={answers.omzet}
              setValue={(v) => setAnswers((s) => ({ ...s, omzet: v }))}
              options={[
                { value: "50-100", label: "€50k – €100k" },
                { value: "100-250", label: "€100k – €250k" },
                { value: "250-1000", label: "€250k – €1m" },
                { value: "1000+", label: "€1m+" },
              ]}
            />
          </StepShell>
        ) : null}

        {step === "finance" ? (
          <StepShell
            title="Financiële hoofdlijnen"
            subtitle="Grove signalen. Geen jaarrekeningdetails."
            onBack={goBack}
            onNext={goNext}
            nextDisabled={!canProceed}
          >
            <RadioRow<Winst>
              label="Winstgevendheid"
              value={answers.winst}
              setValue={(v) => setAnswers((s) => ({ ...s, winst: v }))}
              options={[
                { value: "verlies", label: "Verlies" },
                { value: "breakeven", label: "Break-even" },
                { value: "winst", label: "Winstgevend" },
              ]}
            />
            <RadioRow<BestaandeFin>
              label="Bestaande financiering?"
              value={answers.bestaandeFin}
              setValue={(v) => setAnswers((s) => ({ ...s, bestaandeFin: v }))}
              options={[
                { value: "nee", label: "Nee" },
                { value: "<50", label: "Ja, < €50k" },
                { value: "50+", label: "Ja, €50k+" },
              ]}
            />
          </StepShell>
        ) : null}

        {step === "goal" ? (
          <StepShell
            title="Doel en zekerheden"
            subtitle="Dit beïnvloedt de bandbreedte en de onzekerheid."
            onBack={goBack}
            onNext={goNext}
            nextDisabled={!canProceed}
          >
            <RadioRow<Doel>
              label="Doel van financiering"
              value={answers.doel}
              setValue={(v) => setAnswers((s) => ({ ...s, doel: v }))}
              options={[
                { value: "werkkapitaal", label: "Werkkapitaal" },
                { value: "investering", label: "Investering" },
                { value: "herfinanciering", label: "Herfinanciering" },
              ]}
            />
            <RadioRow<Borg>
              label="Privé-borgstelling mogelijk?"
              value={answers.borg}
              setValue={(v) => setAnswers((s) => ({ ...s, borg: v }))}
              options={[
                { value: "ja", label: "Ja" },
                { value: "nee", label: "Nee" },
              ]}
            />
          </StepShell>
        ) : null}

        {step === "review" ? (
          <StepShell
            title="Samenvatting"
            subtitle="Controleer je invoer. Daarna tonen we een bandbreedte en onzekerheden."
            onBack={goBack}
            onNext={compute}
            nextLabel="Toon bandbreedte"
            nextDisabled={!canProceed}
            footerNote="Let op: dit is geen kredietadvies of garantie."
          >
            <div style={styles.reviewGrid}>
              <div style={styles.reviewRow}>
                <div style={styles.reviewKey}>Rechtsvorm</div>
                <div style={styles.reviewVal}>{answers.rechtsvorm ?? "-"}</div>
              </div>
              <div style={styles.reviewRow}>
                <div style={styles.reviewKey}>12m actief</div>
                <div style={styles.reviewVal}>{answers.actief12m ?? "-"}</div>
              </div>
              <div style={styles.reviewRow}>
                <div style={styles.reviewKey}>Jaaromzet</div>
                <div style={styles.reviewVal}>{answers.omzet ?? "-"}</div>
              </div>
              <div style={styles.reviewRow}>
                <div style={styles.reviewKey}>Winst</div>
                <div style={styles.reviewVal}>{answers.winst ?? "-"}</div>
              </div>
              <div style={styles.reviewRow}>
                <div style={styles.reviewKey}>Bestaande financiering</div>
                <div style={styles.reviewVal}>
                  {answers.bestaandeFin ?? "-"}
                </div>
              </div>
              <div style={styles.reviewRow}>
                <div style={styles.reviewKey}>Doel</div>
                <div style={styles.reviewVal}>{answers.doel ?? "-"}</div>
              </div>
              <div style={styles.reviewRow}>
                <div style={styles.reviewKey}>Borg</div>
                <div style={styles.reviewVal}>{answers.borg ?? "-"}</div>
              </div>
            </div>
          </StepShell>
        ) : null}

        {step === "result" && result ? (
          <ResultView
            answers={answers}
            outcome={result}
            eligibility={exitInfo}
            onRestart={reset}
            onAction={(key) => {
              log("result_action", { key });
              // MVP: geen echte routing. Alleen placeholder gedrag.
              if (key === "vergelijken")
                alert(
                  "Placeholder: in productie zou je hier naar een vergelijklaag gaan.",
                );
              if (key === "meer_uitleg")
                alert(
                  "Placeholder: in productie zou je hier een uitlegpagina tonen.",
                );
              if (key === "advies")
                alert(
                  "Placeholder: in productie zou je hier een adviserend merk tonen.",
                );
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

function ResultView(props: {
  answers: Answers;
  eligibility: Eligibility | null;
  outcome: Outcome;
  onRestart: () => void;
  onAction: (k: "vergelijken" | "meer_uitleg" | "advies") => void;
}) {
  const { outcome, eligibility } = props;

  const heading = useMemo(() => {
    if (eligibility?.kind === "exit") return "Buiten scope (MVP)";
    if (outcome.bucket === "A") return "Ruimte waarschijnlijk aanwezig";
    if (outcome.bucket === "B") return "Onzeker / afhankelijk";
    return "Waarschijnlijk beperkt";
  }, [eligibility, outcome.bucket]);

  const rangeLine = useMemo(() => {
    if (!outcome.rangeEur) return null;
    const [lo, hi] = outcome.rangeEur;
    return `${euro(lo)} – ${euro(hi)}`;
  }, [outcome.rangeEur]);

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div>
          <div style={styles.title}>{heading}</div>
          <div style={styles.subtitle}>
            {rangeLine ? (
              <>
                Globale bandbreedte:{" "}
                <span style={{ fontWeight: 700 }}>{rangeLine}</span>
              </>
            ) : (
              "Geen bandbreedte berekend in MVP-scope."
            )}
          </div>
        </div>
      </div>

      <div style={styles.body}>
        <Section title="Context & aannames" items={outcome.assumptions} />
        <Section title="Grootste onzekerheden" items={outcome.sensitivities} />
        <Section title="Wat dit niet betekent" items={outcome.notMeaning} />

        <div style={{ marginTop: 16 }}>
          <div style={styles.fieldLabel}>
            Volgende stap (placeholder, geen CTA)
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {outcome.suggestedNext.map((s) => (
              <button
                key={s.key}
                style={styles.btnSecondary}
                onClick={() => props.onAction(s.key)}
                title={s.note}
              >
                {s.label}{" "}
                <span style={{ fontWeight: 400, opacity: 0.8 }}>
                  — {s.note}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={styles.footer}>
        <button style={styles.btnPrimary} onClick={props.onRestart}>
          Opnieuw
        </button>
        <div style={styles.footnote}>
          MVP: geen opslag, geen adviesclaim. Output is indicatief.
        </div>
      </div>
    </div>
  );
}

function Section(props: { title: string; items: string[] }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={styles.sectionTitle}>{props.title}</div>
      <ul style={styles.ul}>
        {props.items.map((x, i) => (
          <li key={i} style={styles.li}>
            {x}
          </li>
        ))}
      </ul>
    </div>
  );
}

// -------------------- Minimal inline styles (geen UI libs nodig) --------------------

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#0b0d10",
    color: "#e8eef6",
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji"',
  },
  topbar: {
    position: "sticky",
    top: 0,
    zIndex: 10,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 18px",
    background: "rgba(11,13,16,0.9)",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    backdropFilter: "blur(10px)",
  },
  topbarRight: { display: "flex", gap: 8 },
  brand: { fontWeight: 800, letterSpacing: 0.2 },
  container: { maxWidth: 860, margin: "0 auto", padding: 18 },
  card: {
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 16,
    overflow: "hidden",
    background: "rgba(255,255,255,0.03)",
    boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
  },
  header: {
    padding: 18,
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.02)",
  },
  title: { fontSize: 20, fontWeight: 800, lineHeight: 1.2 },
  subtitle: { marginTop: 6, opacity: 0.85, lineHeight: 1.35 },
  body: { padding: 18 },
  footer: {
    padding: 18,
    borderTop: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  footnote: { fontSize: 12, opacity: 0.75, lineHeight: 1.35 },
  fieldLabel: { fontWeight: 700, marginBottom: 8 },
  sectionTitle: { fontWeight: 800, marginBottom: 6, opacity: 0.95 },
  option: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.15)",
    cursor: "pointer",
  },
  hint: { fontSize: 12, opacity: 0.75, lineHeight: 1.35 },
  ul: { margin: "10px 0 0 18px" },
  li: { marginBottom: 6, opacity: 0.9, lineHeight: 1.35 },
  btnPrimary: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.10)",
    color: "#e8eef6",
    fontWeight: 800,
    cursor: "pointer",
  },
  btnSecondary: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.18)",
    color: "#e8eef6",
    fontWeight: 700,
    cursor: "pointer",
    textAlign: "left",
  },
  btnTertiary: {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "transparent",
    color: "#e8eef6",
    fontWeight: 700,
    cursor: "pointer",
    opacity: 0.9,
  },
  pill: {
    fontSize: 12,
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.05)",
    opacity: 0.9,
  },
  reviewGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 10,
    marginTop: 6,
  },
  reviewRow: {
    display: "grid",
    gridTemplateColumns: "240px 1fr",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.15)",
  },
  reviewKey: { fontWeight: 800, opacity: 0.9 },
  reviewVal: { opacity: 0.9 },
};
