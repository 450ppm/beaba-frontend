import { Link } from 'react-router-dom';
import './LandingPage.css';

export default function LandingPage() {
  return (
    <div className="landing">
      {/* Hero */}
      <section className="landing-hero">
        <img src="/beaba_banner.png" alt="Beaba" className="landing-hero-logo" />
        <p className="landing-hero-subtitle">
          Rendre visible et comprehensible la consommation d'electricite, de gaz
          et d'eau des logements pour encourager le changement de comportement.
        </p>
        <Link to="/login" className="landing-cta">Acces conseiller</Link>
      </section>

      {/* Le kit */}
      <section className="landing-section">
        <h2 className="landing-section-title">Le kit de monitoring</h2>
        <div className="landing-cards">
          <div className="landing-card">
            <span className="landing-card-icon">🌡️</span>
            <h3>Temperature &amp; Humidite</h3>
            <p>6 capteurs Sonoff SNZB-02P mesurent le confort thermique dans chaque piece</p>
          </div>
          <div className="landing-card">
            <span className="landing-card-icon">⚡</span>
            <h3>Consommation electrique</h3>
            <p>10 prises connectees Innr SP 240 mesurent la puissance de chaque appareil</p>
          </div>
          <div className="landing-card">
            <span className="landing-card-icon">🌬️</span>
            <h3>Qualite de l'air</h3>
            <p>Capteur CO2 Heiman HS3AQ pour surveiller la ventilation et la qualite de l'air interieur</p>
          </div>
          <div className="landing-card">
            <span className="landing-card-icon">💧</span>
            <h3>Compteurs</h3>
            <p>Releves des compteurs d'eau, gaz et electricite en debut et fin de campagne</p>
          </div>
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
