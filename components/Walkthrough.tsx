import { useState } from 'react'

// ─── Walkthrough Card Data ──────────────────────────────────────────────────

const CARDS = [
  {
    icon: '◈',
    title: 'Welcome to Cernita',
    titleIt: 'Benvenuti in Cernita',
    body: 'Cernita helps you decide what to keep, sell, ship, or donate \u2014 across your move from Galesburg to Colorado to Italy.',
    bodyIt: 'Cernita ti aiuta a decidere cosa tenere, vendere, spedire o donare \u2014 nel trasloco da Galesburg al Colorado all\u2019Italia.',
    accent: 'var(--terracotta)',
  },
  {
    icon: '\u2708',
    title: 'The Journey',
    titleIt: 'Il viaggio',
    body: 'Your items have a journey: some leave now (sell, donate). Others travel to Colorado. From Colorado, some ship to Italy \u2014 others get sold or used up before the final move.',
    bodyIt: 'I tuoi oggetti hanno un percorso: alcuni partono ora (vendita, donazione). Altri vanno in Colorado. Dal Colorado, alcuni vengono spediti in Italia \u2014 altri venduti o consumati prima del trasloco finale.',
    accent: 'var(--olive)',
    diagram: true,
  },
  {
    icon: '\u2696',
    title: 'Two Perspectives',
    titleIt: 'Due prospettive',
    body: 'Every item is evaluated from two angles: what it costs to ship, and what it costs to replace in Italy. When these perspectives disagree, the item goes to the Discuss tab \u2014 so you can decide together.',
    bodyIt: 'Ogni oggetto viene valutato da due angolazioni: quanto costa spedirlo e quanto costa sostituirlo in Italia. Quando le prospettive non concordano, l\u2019oggetto va nella scheda Discuti \u2014 per decidere insieme.',
    accent: 'var(--gold)',
  },
  {
    icon: '\u25C7',
    title: 'Discuss Together',
    titleIt: 'Discutete insieme',
    body: 'Items marked \u201CNeeds discussion\u201D appear in the Discuss tab. Both of you see the same math. You resolve it together \u2014 the app never decides for you.',
    bodyIt: 'Gli oggetti contrassegnati \u201CRichiede discussione\u201D appaiono nella scheda Discuti. Entrambi vedete gli stessi calcoli. Decidete insieme \u2014 l\u2019app non decide mai al posto vostro.',
    accent: 'var(--terracotta)',
  },
  {
    icon: '\u270E',
    title: 'Overrides & Learning',
    titleIt: 'Correzioni e apprendimento',
    body: 'If the AI gets it wrong, override the decision and tag why (voltage, too heavy, sentimental\u2026). After enough overrides, the app suggests rules to match your preferences.',
    bodyIt: 'Se l\u2019AI sbaglia, correggi la decisione e indica il motivo (voltaggio, troppo pesante, sentimentale\u2026). Dopo abbastanza correzioni, l\u2019app suggerisce regole per adattarsi alle tue preferenze.',
    accent: 'var(--olive)',
  },
  {
    icon: '\u25CE',
    title: 'You\u2019re Ready',
    titleIt: 'Siete pronti',
    body: 'Start by evaluating items \u2014 point the camera, and Cernita does the math.',
    bodyIt: 'Iniziate valutando gli oggetti \u2014 inquadrate con la fotocamera e Cernita fa i calcoli.',
    accent: 'var(--terracotta)',
    isFinal: true,
  },
]

// ─── Journey Diagram ─────────────────────────────────────────────────────────

function JourneyDiagram() {
  return (
    <div className="wt-diagram">
      <div className="wt-diagram-row">
        <div className="wt-diagram-node wt-diagram-now">
          <span className="wt-diagram-node-icon">🏠</span>
          <span className="wt-diagram-node-label">Illinois</span>
        </div>
        <span className="wt-diagram-arrow">\u2192</span>
        <div className="wt-diagram-node wt-diagram-co">
          <span className="wt-diagram-node-icon">🏔</span>
          <span className="wt-diagram-node-label">Colorado</span>
        </div>
        <span className="wt-diagram-arrow">\u2192</span>
        <div className="wt-diagram-node wt-diagram-it">
          <span className="wt-diagram-node-icon">🇮🇹</span>
          <span className="wt-diagram-node-label">Italy</span>
        </div>
      </div>
      <div className="wt-diagram-exits">
        <span className="wt-diagram-exit">Sell / Donate / Dispose \u2190 now</span>
        <span className="wt-diagram-exit">Sell / Donate / Consume \u2190 in CO</span>
      </div>
    </div>
  )
}

// ─── Walkthrough Component ──────────────────────────────────────────────────

export default function Walkthrough({ onComplete }: { onComplete: () => void }) {
  const [currentCard, setCurrentCard] = useState(0)
  const card = CARDS[currentCard]
  const isLast = currentCard === CARDS.length - 1

  function next() {
    if (isLast) {
      onComplete()
    } else {
      setCurrentCard(c => c + 1)
    }
  }

  function prev() {
    if (currentCard > 0) setCurrentCard(c => c - 1)
  }

  return (
    <div className="wt-overlay">
      <div className="wt-card">
        {/* Skip link */}
        <button className="wt-skip" onClick={onComplete}>
          Skip \u00B7 Salta
        </button>

        {/* Illustration area */}
        <div className="wt-illustration" style={{ borderBottomColor: card.accent }}>
          <span className="wt-illustration-icon" style={{ color: card.accent }}>
            {card.icon}
          </span>
          {card.diagram && <JourneyDiagram />}
        </div>

        {/* Content */}
        <div className="wt-content">
          <h2 className="wt-title serif">{card.title}</h2>
          <p className="wt-title-it">{card.titleIt}</p>
          <p className="wt-body">{card.body}</p>
          <p className="wt-body-it">{card.bodyIt}</p>
        </div>

        {/* Navigation */}
        <div className="wt-nav">
          {/* Progress dots */}
          <div className="wt-dots">
            {CARDS.map((_, i) => (
              <span
                key={i}
                className={`wt-dot${i === currentCard ? ' active' : ''}`}
              />
            ))}
          </div>

          <div className="wt-buttons">
            {currentCard > 0 && (
              <button className="btn-secondary wt-btn-back" onClick={prev}>
                Back
              </button>
            )}
            <button className="btn-primary wt-btn-next" onClick={next}>
              {isLast ? 'Get started \u00B7 Iniziamo' : 'Next \u00B7 Avanti'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Help Accordion (for Settings page) ─────────────────────────────────────

export function HelpAccordion({ onReplay }: { onReplay: () => void }) {
  const [openSection, setOpenSection] = useState<number | null>(null)

  function toggle(idx: number) {
    setOpenSection(openSection === idx ? null : idx)
  }

  return (
    <div className="help-accordion">
      {CARDS.map((card, idx) => (
        <div key={idx} className="help-accordion-item">
          <button
            className={`help-accordion-header${openSection === idx ? ' open' : ''}`}
            onClick={() => toggle(idx)}
          >
            <span className="help-accordion-icon">{card.icon}</span>
            <span className="help-accordion-title">{card.title}</span>
            <span className="help-accordion-title-it">{card.titleIt}</span>
            <span className="help-accordion-chevron">{openSection === idx ? '\u25B4' : '\u25BE'}</span>
          </button>
          {openSection === idx && (
            <div className="help-accordion-body">
              <p className="help-accordion-text">{card.body}</p>
              <p className="help-accordion-text-it">{card.bodyIt}</p>
              {card.diagram && <JourneyDiagram />}
            </div>
          )}
        </div>
      ))}

      <button className="btn-secondary help-replay-btn" onClick={onReplay}>
        Replay full walkthrough \u00B7 Ripeti il tour completo
      </button>
    </div>
  )
}
