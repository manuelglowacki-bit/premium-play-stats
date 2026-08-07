import React from 'react';
import MatchBonus1 from '../components/MatchBonus1'; // Vérifie que ton composant est bien dans ce dossier
import './Pronostic.css'; // On lie le CSS généré juste au-dessus

export default function Pronostic() {
    return (
        <div className="page-pronostic">
            <div className="header-pronostic">
                <h2>🔥 Matchs bonus <span className="sous-titre" style={{fontSize: '14px', color: '#888'}}>(1 match par championnat)</span></h2>
                <div className="points-info" style={{fontSize: '12px', letterSpacing: '1px'}}>SCORE EXACT = 3 PTS • RÉSULTAT = 2 PTS</div>
            </div>

            <div className="cartes-container" style={{ display: 'flex', gap: '20px', marginTop: '30px' }}>
                <MatchBonus1 />
            </div>
            
            <p className="footer-texte" style={{marginTop: '40px', color: '#555', textAlign: 'center'}}>Tu ne peux choisir qu'un seul match bonus par championnat.</p>
        </div>
    );
}
