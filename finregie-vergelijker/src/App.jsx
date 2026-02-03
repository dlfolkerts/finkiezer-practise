import React, { useMemo, useState } from "react";

/**
 * Mini demo site (single-file React SPA)
 *
 * Doel (best practice):
 * - Pad A (commercieel): /prive-bankrekening  → selectie + CTA's
 * - Pad B (bron/AI):     /bankrekeningen      → marktoverzicht (naam-only, uitleg)
 * - Pad B (beslis):      /uitleg/prive-bankrekening-kiezen → AI-first besliswijzer (geen CTA's)
 *
 * Labels:
 * - Assumption: demo-data; vervang door echte feeds/criteria
 * - Best practice: scheiding van intent (uitleg/bron vs conversie)
 */

// ---------------------------
// Tiny router (no deps)
// ---------------------------
function useHashRoute() {
  const get = () => {
    const h = window.location.hash || "#/";
    return h.startsWith("#") ? h.slice(1) : h;
  };
  const [path, setPath] = useState(get());

  React.useEffect(() => {
    const onHash = () => setPath(get());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const navigate = (to) => {
    window.location.hash = `#${to}`;
  };

  return { path, navigate };
}

function Link({ to, children, className = "" }) {
  return (
    <a href={`#${to}`} className={className}>
      {children}
    </a>
  );
}

// ---------------------------
// Demo data
// ---------------------------
const COMMERCIAL_PRODUCTS = [
  // Demo note: premiumContext blocks illustrate Model C (paid context, not ranking)

  {
    id: "bank_a",
    name: "Bank A Betaalrekening",
    sponsor: true,
    highlight: "Lage vaste kosten",
    monthly: 0,
    features: ["Online openen", "Apple Pay", "Gratis bankpas"],
    premiumContext: {
      cost_focus: {
        title: "Waarom dit past bij dit profiel",
        text: [
          "Wordt vaak gekozen door gebruikers met weinig transacties.",
          "Lage vaste kosten en volledig online gebruik."
        ]
      },
      app_first: {
        title: "Waarom dit past bij dit profiel",
        text: [
          "Populair bij gebruikers die hun bankzaken via de app regelen.",
          "Sterke focus op mobiel gemak en realtime inzicht."
        ]
      },
      cash_user: {
        title: "Waarom dit minder geschikt is voor dit profiel",
        text: [
          "Minder vaak gekozen door gebruikers die contant geld nodig hebben.",
          "Beperkte cash- en kantooropties."
        ]
      }
    },
  },
  {
    id: "bank_b",
    name: "Bank B Online",
    sponsor: true,
    highlight: "Veel functies",
    monthly: 3.5,
    features: ["Online openen", "Spaarpotjes", "Extra pas mogelijk"],
    premiumContext: {
      cost_focus: {
        title: "Waarom dit past bij dit profiel",
        text: [
          "Geschikt bij lage tot gemiddelde kostenfocus.",
          "Handig bij overzicht en eenvoudige extra’s."
        ]
      },
      app_first: {
        title: "Waarom dit past bij dit profiel",
        text: [
          "Veel gebruikt door app-first gebruikers.",
          "Sterke categorisering en notificaties."
        ]
      }
    },
  },
  {
    id: "bank_c",
    name: "Bank C Compleet",
    sponsor: true,
    highlight: "Kantoornetwerk",
    monthly: 6.95,
    features: ["Ook fysiek", "Cash-storten mogelijk", "Gezamenlijke rekening"],
    premiumContext: {
      cash_user: {
        title: "Waarom dit past bij dit profiel",
        text: [
          "Wordt vaker gekozen door gebruikers met contant geld.",
          "Beschikbaarheid van kantoren en cashdiensten."
        ]
      }
    },
  },
  {
    id: "bank_d",
    name: "Bank D Budget",
    sponsor: false,
    highlight: "Basis",
    monthly: 1.5,
    features: ["Online", "Beperkte extras", "Simpel"],
  },
  {
    id: "bank_e",
    name: "Bank E Premium",
    sponsor: false,
    highlight: "Service",
    monthly: 9.95,
    features: ["Uitgebreide support", "Reisverzekering add-on", "Gezinsopties"],
  },
  {
    id: "bank_f",
    name: "Bank F Neobank",
    sponsor: false,
    highlight: "App-first",
    monthly: 0,
    features: ["App-first", "Virtuele kaarten", "Inzicht"],
  },
];

const NON_INCLUDED_PROVIDERS = ["Bank X", "Bank Y", "Bank Z"];

// AI-first persona’s (demo)
const PERSONAS = {
  standard_low_cost: {
    id: "standard_low_cost",
    title: "NL consument – standaard gebruik, focus lage kosten",
    assumptions: ["NL resident", "geen contant geld", "standaard gebruik", "focus: lage vaste kosten"],
    inputs: { needsCash: false, wantsBranch: false, costFocus: "low_fixed" },
    scenarios: [
      { id: "needs_cash", label: "Ik heb contant geld nodig" },
      { id: "wants_branch", label: "Ik wil een fysiek kantoor" },
    ],
  },
  needs_cash: {
    id: "needs_cash",
    title: "NL consument – contant geld nodig",
    assumptions: ["NL resident", "cash nodig", "focus: toepasbaarheid"],
    inputs: { needsCash: true, wantsBranch: false, costFocus: "balanced" },
    scenarios: [
      { id: "standard_low_cost", label: "Terug naar standaard" },
      { id: "wants_branch", label: "Ik wil een fysiek kantoor" },
    ],
  },
  wants_branch: {
    id: "wants_branch",
    title: "NL consument – voorkeur fysiek kantoor",
    assumptions: ["NL resident", "kantoor gewenst", "focus: service/zekerheid"],
    inputs: { needsCash: false, wantsBranch: true, costFocus: "features" },
    scenarios: [
      { id: "standard_low_cost", label: "Terug naar standaard" },
      { id: "needs_cash", label: "Ik heb contant geld nodig" },
    ],
  },
};

const REASON_TEXT = {
  not_included_non_partner: "Actief in NL, maar niet opgenomen in deze selectie (geen direct vergelijk-/afsluitpad).",
  monthly_cost_too_high: "Vaste kosten passen minder bij het gekozen profiel.",
  branch_required: "Profiel vraagt fysiek kantoor; dit product is primair online.",
  cash_required: "Profiel vraagt cash-functionaliteit; dit product biedt dit niet.",
};

function euro(n) {
  return `€${Number(n).toFixed(2).replace(".", ",")}`;
}

// ---------------------------
// Layout
// ---------------------------
function Shell({ children }) {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <TopNav />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      <Footer />
    </div>
  );
}

function TopNav() {
  return (
    <div className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-lg font-semibold tracking-tight">
            Bankenvergelijking (demo)
          </Link>
          <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">
            bronpad + commercieel pad
          </span>
        </div>

        <nav className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-3">
            <span className="text-neutral-500">Vergelijken</span>
            <Link to="/prive-bankrekening" className="font-medium hover:underline">
              Privé bankrekening
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-neutral-500">Informatie</span>
            <Link to="/bankrekeningen" className="font-medium hover:underline">
              Over bankrekeningen
            </Link>
            <Link to="/uitleg/prive-bankrekening-kiezen" className="font-medium hover:underline">
              Besliswijzer
            </Link>
          </div>
        </nav>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <div className="mt-10 border-t bg-white">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <div className="text-sm font-semibold">Informatie</div>
            <ul className="mt-2 space-y-1 text-sm text-neutral-700">
              <li>
                <Link to="/bankrekeningen" className="hover:underline">
                  Over bankrekeningen in Nederland
                </Link>
              </li>
              <li>
                <Link to="/uitleg/prive-bankrekening-kiezen" className="hover:underline">
                  Hoe kies je een privé bankrekening?
                </Link>
              </li>
              <li>
                <Link to="/prive-bankrekening" className="hover:underline">
                  Privé bankrekening vergelijken (selectie)
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <div className="text-sm font-semibold">Disclaimer</div>
            <p className="mt-2 text-sm text-neutral-700">
              Vergelijkingen zijn gebaseerd op aannames en beschikbare informatie. Controleer altijd voorwaarden bij de
              aanbieder.
            </p>
          </div>
          <div>
            <div className="text-sm font-semibold">Demo-notitie</div>
            <p className="mt-2 text-sm text-neutral-700">
              Dit is een demonstratie van een gescheiden bronpad (AI/trust) en commercieel pad (CTA/conversie).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ children, className = "" }) {
  return <div className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200 ${className}`}>{children}</div>;
}

function Pill({ children }) {
  return <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">{children}</span>;
}

function Tabs({ active, setActive, tabs }) {
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={
              active === t.id
                ? "rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
                : "rounded-full bg-white px-4 py-2 text-sm font-medium text-neutral-800 ring-1 ring-neutral-200 hover:bg-neutral-50"
            }
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------
// Pages
// ---------------------------
function Home() {
  return (
    <Shell>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <h1 className="text-2xl font-semibold">Mini demo: twee paden</h1>
          <p className="mt-2 text-sm text-neutral-700">
            Pad A is commercieel (selectie + CTA’s). Pad B is bron/AI (uitleg + besliscontext). Ze linken naar elkaar,
            maar blijven functioneel gescheiden.
          </p>

          <div className="mt-4 grid gap-3">
            <Link
              to="/prive-bankrekening"
              className="rounded-xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white hover:opacity-90"
            >
              Ga naar commercieel pad → Privé bankrekening vergelijken
            </Link>
            <Link
              to="/bankrekeningen"
              className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-neutral-900 ring-1 ring-neutral-200 hover:bg-neutral-50"
            >
              Ga naar bronpad → Over bankrekeningen
            </Link>
            <Link
              to="/uitleg/prive-bankrekening-kiezen"
              className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-neutral-900 ring-1 ring-neutral-200 hover:bg-neutral-50"
            >
              Ga naar bronpad → AI-first besliswijzer
            </Link>
          </div>
        </Card>

        <Card>
          <div className="text-sm font-semibold">Wat je laat zien aan anderen</div>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-neutral-700">
            <li>
              <span className="font-medium">Commercieel pad</span>: selectie, filters, CTA’s, transparantie over scope.
            </li>
            <li>
              <span className="font-medium">Bronpad</span>: marktoverzicht, waarom banken ontbreken, marktdekking.
            </li>
            <li>
              <span className="font-medium">AI-first besliswijzer</span>: aannames → selectie → uitsluitingen →
              scenario’s → marktdekking.
            </li>
          </ul>
          <div className="mt-4 rounded-xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
            <div className="text-xs font-semibold text-neutral-700">Kernprincipe</div>
            <div className="mt-1 text-sm text-neutral-700">
              AI linkt naar uitleg/besliscontext. Conversie gebeurt op de selectiepagina. Nooit mengen op één pagina.
            </div>
          </div>
        </Card>
      </div>
    </Shell>
  );
}

function CommercialPrivateAccount() {
  // Demo: kies actief profiel voor Premium Context rendering
  const profileKey = "cost_focus"; // cost_focus | app_first | cash_user

  const [showMore, setShowMore] = useState(false);
  const [activeTab, setActiveTab] = useState("over");

  // demo: top 3 as "prominent" (could be paid), rest behind "meer producten"
  const top = COMMERCIAL_PRODUCTS.slice(0, 3);
  const rest = COMMERCIAL_PRODUCTS.slice(3);

  return (
    <Shell>
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Privé bankrekening vergelijken</h1>
        <p className="mt-1 text-neutral-600">Selectie van bankrekeningen die online te vergelijken en af te sluiten zijn</p>
      </header>

      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-sm font-semibold">Transparantie</div>
            <p className="mt-1 text-sm text-neutral-700">
              Deze pagina toont een selectie van rekeningen met een direct vergelijk-/afsluitpad. Niet alle banken zijn
              opgenomen. Lees de marktcontext en waarom banken ontbreken:
              {" "}
              <Link to="/bankrekeningen" className="font-semibold underline">
                Over bankrekeningen in Nederland
              </Link>
              {" "}en de beslislogica in{" "}
              <Link to="/uitleg/prive-bankrekening-kiezen" className="font-semibold underline">
                de besliswijzer
              </Link>
              .
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Pill>commercieel pad</Pill>
            <Pill>CTA’s</Pill>
          </div>
        </div>
      </Card>

      <section className="mt-6">
        <h2 className="text-xl font-semibold">Geselecteerde producten</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Prominente plaatsing kan commercieel zijn; eigenschappen en criteria blijven gelijk beschreven.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {top.map((p, idx) => (
            <Card key={p.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{p.name}</div>
                  <div className="mt-1 text-xs text-neutral-600">Vanaf {euro(p.monthly)} / maand</div>
                </div>
                <Pill>{idx === 0 ? "gesponsord" : "geselecteerd"}</Pill>
              </div>
              <div className="mt-3 text-xs font-medium text-neutral-700">{p.highlight}</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-neutral-700">
                {p.features.slice(0, 3).map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>

              {p.premiumContext && p.premiumContext[profileKey] && (
                <div className="mt-3 rounded-xl bg-neutral-50 p-3 text-xs text-neutral-700 ring-1 ring-neutral-200">
                  <div className="font-semibold">{p.premiumContext[profileKey].title}</div>
                  <ul className="mt-1 list-disc pl-5">
                    {p.premiumContext[profileKey].text.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  <div className="mt-2 text-[11px] text-neutral-500">Contextvermelding · geen advies</div>
                </div>
              )}

              <button
                onClick={() => alert("Demo: clickout / lead")}
                className="mt-4 w-full rounded-xl bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Meer info
              </button>
            </Card>
          ))}
        </div>

        <div className="mt-4">
          <button
            onClick={() => setShowMore((v) => !v)}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-neutral-900 ring-1 ring-neutral-200 hover:bg-neutral-50"
          >
            {showMore ? "Verberg extra producten" : `Meer producten (${rest.length})`}
          </button>

          {showMore && (
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {rest.map((p) => (
                <Card key={p.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold">{p.name}</div>
                      <div className="mt-1 text-xs text-neutral-600">Vanaf {euro(p.monthly)} / maand</div>
                    </div>
                    <Pill>{p.sponsor ? "partner" : "niet-partner"}</Pill>
                  </div>
                  <div className="mt-3 text-xs font-medium text-neutral-700">{p.highlight}</div>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-neutral-700">
                    {p.features.slice(0, 3).map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                  <button
                    onClick={() => alert("Demo: clickout / lead")}
                    className="mt-4 w-full rounded-xl bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
                  >
                    Meer info
                  </button>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mt-8">
        <Tabs
          active={activeTab}
          setActive={setActiveTab}
          tabs={[
            { id: "over", label: "Over deze vergelijking" },
            { id: "markt", label: "Marktdekking" },
            { id: "werkwijze", label: "Werkwijze" },
          ]}
        />

        <Card className="mt-3">
          {activeTab === "over" && (
            <div className="space-y-2 text-sm text-neutral-700">
              <p>
                Deze pagina toont een selectie van rekeningen die online te vergelijken en direct af te sluiten zijn.
                Niet alle banken zijn opgenomen.
              </p>
              <p>
                Marktcontext: <Link to="/bankrekeningen" className="font-semibold underline">Over bankrekeningen</Link>.
                Beslislogica: <Link to="/uitleg/prive-bankrekening-kiezen" className="font-semibold underline">Besliswijzer</Link>.
              </p>
            </div>
          )}

          {activeTab === "markt" && (
            <div className="space-y-3 text-sm text-neutral-700">
              <div className="text-base font-semibold text-neutral-900">Deze vergelijking bevat niet alle aanbieders</div>
              <p>
                De markt is breder dan deze selectie. Sommige aanbieders zijn niet online te vergelijken of werken niet
                met vergelijkingsplatforms.
              </p>
              <div>
                <div className="text-sm font-medium text-neutral-800">Niet meegenomen aanbieders (naam-only)</div>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {NON_INCLUDED_PROVIDERS.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {activeTab === "werkwijze" && (
            <div className="space-y-3 text-sm text-neutral-700">
              <ol className="list-decimal space-y-1 pl-5">
                <li>We beschrijven vaste productkenmerken en voorwaarden (voor zover beschikbaar).</li>
                <li>We tonen een selectie met direct vergelijk-/afsluitpad.</li>
                <li>We verwijzen naar bronpagina’s voor marktcontext en beslislogica.</li>
              </ol>
              <p className="text-neutral-600">
                Plaatsing kan commercieel zijn; de beschreven kenmerken zijn bedoeld als neutrale productinformatie.
              </p>
            </div>
          )}
        </Card>
      </section>
    </Shell>
  );
}

function MarketOverviewBankrekeningen() {
  return (
    <Shell>
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Over bankrekeningen in Nederland</h1>
        <p className="mt-1 text-neutral-600">Marktoverzicht en uitleg (bronpad)</p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Rol van deze pagina</div>
            <Pill>bronpad</Pill>
          </div>
          <p className="mt-2 text-sm text-neutral-700">
            Deze pagina legt de markt uit: welke typen bankrekeningen bestaan, waarom sommige banken niet in
            vergelijkingen voorkomen, en wanneer vergelijken zinvol is. Geen ranking, geen CTA.
          </p>
        </Card>

        <Card>
          <div className="text-sm font-semibold">Wil je concrete opties bekijken?</div>
          <p className="mt-2 text-sm text-neutral-700">
            Dan is de selectiepagina geschikt: <Link to="/prive-bankrekening" className="font-semibold underline">Privé bankrekening vergelijken</Link>.
          </p>
          <p className="mt-2 text-xs text-neutral-500">Zachte link, zonder knop en zonder urgentie.</p>
        </Card>
      </div>

      <section className="mt-6 grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold">Welke soorten bankrekeningen bestaan er?</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-neutral-700">
            <li>Standaard betaalrekeningen (dagelijks gebruik)</li>
            <li>Online banken / neobanken (app-first)</li>
            <li>Banken met fysiek kantorennetwerk</li>
            <li>Specifieke rekeningen (student/jongeren/gezamenlijk)</li>
          </ul>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold">Waarom ontbreken banken in vergelijkingen?</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-neutral-700">
            <li>Sommige banken werken niet met vergelijkingsplatforms.</li>
            <li>Sommige producten zijn niet direct online af te sluiten.</li>
            <li>Sommige kenmerken zijn niet gestandaardiseerd vergelijkbaar.</li>
          </ul>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold">Marktdekking</h2>
          <p className="mt-2 text-sm text-neutral-700">
            Niet alle aanbieders zijn opgenomen in commerciële selecties. Hieronder een naam-only lijst met voorbeelden.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-neutral-700">
            {NON_INCLUDED_PROVIDERS.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-neutral-500">Geen links, geen logo’s, geen CTA.</p>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold">Wanneer is vergelijken minder geschikt?</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-neutral-700">
            <li>Complexe situaties of maatwerkbehoeften</li>
            <li>Specifieke internationale vereisten</li>
            <li>Combinatie met kredietfaciliteiten of bijzondere voorwaarden</li>
          </ul>
        </Card>
      </section>
    </Shell>
  );
}

function AiFirstDecisionGuide() {
  const [personaId, setPersonaId] = useState("standard_low_cost");
  const [activeTab, setActiveTab] = useState("toelichting");

  const persona = PERSONAS[personaId];

  // Demo decision: eligible = sponsor products that fit profile; exclusions include non-partners and mismatches
  const decision = useMemo(() => {
    const eligible = [];
    const excluded = [];

    for (const p of COMMERCIAL_PRODUCTS) {
      // demo rules
      if (persona.inputs.needsCash && p.id !== "bank_c") {
        excluded.push({ product: p, reason: "cash_required" });
        continue;
      }
      if (persona.inputs.wantsBranch && p.id !== "bank_c") {
        excluded.push({ product: p, reason: "branch_required" });
        continue;
      }
      if (persona.inputs.costFocus === "low_fixed" && p.monthly > 6) {
        excluded.push({ product: p, reason: "monthly_cost_too_high" });
        continue;
      }

      if (p.sponsor) eligible.push(p);
      else excluded.push({ product: p, reason: "not_included_non_partner" });
    }

    // Cap eligible shown (AI-first wireframe: show 2–4)
    return {
      eligible: eligible.slice(0, 3),
      excluded,
    };
  }, [personaId]);

  return (
    <Shell>
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Besliswijzer: privé bankrekening kiezen</h1>
        <p className="mt-1 text-neutral-600">AI-first besliscontext (bronpad, geen CTA’s)</p>
      </header>

      {/* VIEWPORT 1 — Besliscontext */}
      <Card>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-sm font-semibold">Besliscontext</div>
            <div className="mt-1 text-lg font-semibold">{persona.title}</div>
            <div className="mt-3 text-sm font-semibold">Aannames</div>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-neutral-700">
              {persona.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-neutral-600">
              De onderstaande selectie blijft over op basis van dit profiel en deze aannames.
            </p>
          </div>
          <div className="min-w-[280px]">
            <div className="text-sm font-semibold">Wat verandert deze selectie?</div>
            <div className="mt-2 flex flex-col gap-2">
              {persona.scenarios.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setPersonaId(s.id)}
                  className="rounded-xl bg-neutral-900 px-3 py-2 text-left text-sm font-semibold text-white hover:opacity-90"
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="mt-3 text-xs text-neutral-500">Vaste scenario’s, geen vrije invoer.</div>
          </div>
        </div>
      </Card>

      {/* VIEWPORT 2 — Resultaten (no CTA) */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold">Overblijvende opties binnen dit profiel</h2>
        <p className="mt-1 text-sm text-neutral-600">Geen CTA’s op deze pagina. Dit is besliscontext, geen funnel.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {decision.eligible.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{p.name}</div>
                  <div className="mt-1 text-xs text-neutral-600">Indicatie: vanaf {euro(p.monthly)} / maand</div>
                </div>
                <Pill>voorbeeld</Pill>
              </div>
              <div className="mt-3 text-xs font-medium text-neutral-700">{p.highlight}</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-neutral-700">
                {p.features.slice(0, 3).map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>

      {/* VIEWPORT 3 — Uitsluitingen */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold">Waarom andere rekeningen hier niet staan</h2>
        <Card className="mt-3">
          <ul className="space-y-2 text-sm text-neutral-800">
            {decision.excluded.map(({ product, reason }) => (
              <li key={`${product.id}-${reason}`} className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{product.name}</div>
                  <div className="text-neutral-600">{REASON_TEXT[reason] || "Niet meegenomen."}</div>
                </div>
                <Pill>{reason}</Pill>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {/* VIEWPORT 5 — Grenzen */}
      <section className="mt-8">
        <Card>
          <h2 className="text-xl font-semibold">Wanneer is deze besliswijzer minder geschikt?</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-neutral-700">
            <li>Complexe combinaties van rekeningen, maatwerkbehoeften of uitzonderlijke voorwaarden.</li>
            <li>Specifieke internationale vereisten of bijzondere inkomens-/verificatiepaden.</li>
          </ul>
        </Card>
      </section>

      {/* VIEWPORT 6 — Tabs */}
      <section className="mt-8">
        <Tabs
          active={activeTab}
          setActive={setActiveTab}
          tabs={[
            { id: "toelichting", label: "Toelichting" },
            { id: "marktdekking", label: "Marktdekking" },
            { id: "werkwijze", label: "Werkwijze" },
          ]}
        />
        <Card className="mt-3">
          {activeTab === "toelichting" && (
            <div className="space-y-2 text-sm text-neutral-700">
              <p>Deze pagina is een uitleg van besliscontext op basis van aannames. Het is geen persoonlijk advies.</p>
              <p>De voorbeelden tonen hoe selectie en uitsluiting werkt; volledige wegingen publiceren we niet.</p>
            </div>
          )}

          {activeTab === "marktdekking" && (
            <div className="space-y-3 text-sm text-neutral-700">
              <div className="text-base font-semibold text-neutral-900">Deze vergelijking bevat niet alle aanbieders</div>
              <p>
                De markt is breder dan dit voorbeeld. Sommige aanbieders zijn niet online te vergelijken of werken niet
                met vergelijkingsplatforms.
              </p>
              <div>
                <div className="text-sm font-medium text-neutral-800">Niet meegenomen aanbieders (naam-only)</div>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {NON_INCLUDED_PROVIDERS.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </div>
              <p className="text-xs text-neutral-500">Geen links, geen logo’s, geen CTA. Alleen context.</p>
            </div>
          )}

          {activeTab === "werkwijze" && (
            <div className="space-y-3 text-sm text-neutral-700">
              <ol className="list-decimal space-y-1 pl-5">
                <li>Definieer een gebruikssituatie (profiel + aannames).</li>
                <li>Sluit opties uit die niet passen (met reden).</li>
                <li>Toon overblijvende opties als voorbeeld van beslisuitkomst.</li>
              </ol>
              <p className="text-neutral-600">De volgorde is niet gebaseerd op betalingen, maar op toepasbaarheid binnen het profiel.</p>
            </div>
          )}
        </Card>
      </section>

      {/* Soft link back to commercial */}
      <section className="mt-8">
        <Card>
          <div className="text-sm font-semibold">Concrete selectie bekijken</div>
          <p className="mt-2 text-sm text-neutral-700">
            Wil je rekeningen bekijken die online te vergelijken en af te sluiten zijn? Zie de selectiepagina:
            {" "}
            <Link to="/prive-bankrekening" className="font-semibold underline">
              Privé bankrekening vergelijken
            </Link>
            .
          </p>
          <p className="mt-2 text-xs text-neutral-500">Zachte tekstlink, geen knop.</p>
        </Card>
      </section>
    </Shell>
  );
}

function NotFound() {
  return (
    <Shell>
      <Card>
        <div className="text-lg font-semibold">Pagina niet gevonden</div>
        <p className="mt-2 text-sm text-neutral-700">
          Ga terug naar <Link to="/" className="font-semibold underline">home</Link>.
        </p>
      </Card>
    </Shell>
  );
}

// ---------------------------
// App
// ---------------------------
export default function DemoSite() {
  const { path } = useHashRoute();

  // Normalize
  const p = path || "/";

  if (p === "/") return <Home />;
  if (p === "/prive-bankrekening") return <CommercialPrivateAccount />;
  if (p === "/bankrekeningen") return <MarketOverviewBankrekeningen />;
  if (p === "/uitleg/prive-bankrekening-kiezen") return <AiFirstDecisionGuide />;
  return <NotFound />;
}
