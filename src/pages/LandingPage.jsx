import { useState } from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

export default function LandingPage() {
  const [showVideo, setShowVideo] = useState(false);

  return (
    <div className="landing">
      {/* Hero */}
      <section className="landing-hero">
        <img src="/beaba_banner.png" alt="Beaba" className="landing-hero-logo" />
        <p className="landing-hero-subtitle">
          Repenser le confort et rendre visible la consommation d'electricite,
          de gaz et d'eau des logements pour encourager un changement durable
          des comportements.
        </p>
        <div className="landing-cta-row">
          <Link to="/login" className="landing-cta">Acces conseiller</Link>
          <button
            type="button"
            className="landing-cta landing-cta-video"
            onClick={() => setShowVideo(true)}
          >
            <span className="landing-cta-play">▶</span>
            Decouvrir le projet en video
          </button>
        </div>
      </section>

      {/* Video modal */}
      {showVideo && (
        <div className="video-modal-overlay" onClick={() => setShowVideo(false)}>
          <div className="video-modal" onClick={e => e.stopPropagation()}>
            <button
              className="video-modal-close"
              onClick={() => setShowVideo(false)}
              aria-label="Fermer"
            >
              ✕
            </button>
            <div className="video-modal-iframe-wrapper">
              <iframe
                src="https://www.youtube.com/embed/3FrPZTTOWNU?start=596&autoplay=1"
                title="Beaba — Decouvrir le projet"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}

      {/* Le kit */}
      <section className="landing-section">
        <h2 className="landing-section-title">Le kit de monitoring</h2>
        <div className="landing-cards">
          <div className="landing-card">
            <span className="landing-card-icon">🌡️</span>
            <h3>Temperature &amp; humidite</h3>
            <p>Des capteurs mesurent le confort thermique dans chaque piece du logement</p>
          </div>
          <div className="landing-card">
            <span className="landing-card-icon">⚡</span>
            <h3>Consommation electrique</h3>
            <p>Des prises connectees mesurent la puissance appelee par chaque appareil</p>
          </div>
          <div className="landing-card">
            <span className="landing-card-icon">🌬️</span>
            <h3>Qualite de l'air</h3>
            <p>Un capteur CO2 suit la ventilation et la qualite de l'air interieur</p>
          </div>
          <div className="landing-card">
            <span className="landing-card-icon">💧</span>
            <h3>Compteurs</h3>
            <p>Releves des compteurs d'eau, de gaz et d'electricite en debut et fin de campagne</p>
          </div>
        </div>
        <div className="landing-kit-image">
          <img src="/kit.png" alt="Le kit Beaba" />
        </div>
      </section>

      {/* Comment ca marche */}
      <section className="landing-section">
        <h2 className="landing-section-title">Comment ca marche</h2>
        <div className="landing-timeline">
          <div className="landing-step">
            <span className="landing-step-number">1</span>
            <h3>Installation</h3>
            <p>Le conseiller en renovation installe le kit chez l'habitant et configure les capteurs</p>
          </div>
          <div className="landing-step">
            <span className="landing-step-number">2</span>
            <h3>Mesure</h3>
            <p>Les capteurs enregistrent en continu pendant 1 mois</p>
          </div>
          <div className="landing-step">
            <span className="landing-step-number">3</span>
            <h3>Analyse</h3>
            <p>Les donnees sont analysees automatiquement et mises en perspective</p>
          </div>
          <div className="landing-step">
            <span className="landing-step-number">4</span>
            <h3>Rapport</h3>
            <p>Un rapport pedagogique est remis a l'habitant avec des recommandations concretes</p>
          </div>
        </div>
      </section>

      {/* Le projet */}
      <section className="landing-section landing-project">
        <h2 className="landing-section-title">Le projet</h2>
        <p className="landing-project-text">
          Beaba est un outil open source developpe par
          l'<strong>atelier d'architecture 450ppm</strong> en partenariat avec
          la <strong>Maison de quartier Bonnevie</strong>.
        </p>
        <p className="landing-project-text">
          Le projet beneficie du soutien de <strong>Bruxelles Environnement</strong>,
          de la <strong>Commune de Molenbeek</strong> et de <strong>urban.brussels</strong>.
        </p>

        <div className="landing-partners-banner">
          <img src="/partners-banner.png" alt="Partenaires : 450ppm, Bonnevie, Bruxelles Environnement, Molenbeek, urban.brussels" />
        </div>
      </section>

      {/* Open source */}
      <section className="landing-section landing-opensource">
        <h2 className="landing-section-title">Open source</h2>
        <p className="landing-opensource-text">
          Le code source de Beaba est disponible librement sur GitHub.
          Contribuez, adaptez et deployez le kit dans votre quartier.
        </p>
        <a
          href="https://github.com/450ppm"
          target="_blank"
          rel="noopener noreferrer"
          className="landing-github-link"
        >
          Voir sur GitHub
        </a>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <p>&copy; 2026 450ppm &mdash; Beaba</p>
        <a href="https://450ppm.be" target="_blank" rel="noopener noreferrer">
          450ppm.be
        </a>
      </footer>
    </div>
  );
}
