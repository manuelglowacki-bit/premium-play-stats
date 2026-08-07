import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function FavoriteTeamCard({ userProfile }) {
  const [team, setTeam] = useState(userProfile?.favorite_team || null);
  const [locked, setLocked] = useState(false);
  const [deadline, setDeadline] = useState('');

  useEffect(() => {
    // Vérifier la date limite et charger les réglages
    async function checkLockStatus() {
      const { data: settings } = await supabase.from('app_settings').select('*');
      const deadlineSetting = settings.find(s => s.key === 'favorite_team_deadline');
      const autoLockSetting = settings.find(s => s.key === 'favorite_team_auto_lock');

      if (deadlineSetting) setDeadline(new Date(deadlineSetting.value).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' }));

      if (autoLockSetting?.value === 'true' && new Date() > new Date(deadlineSetting.value) && !userProfile.favorite_team_override) {
        setLocked(true);
      }
    }
    checkLockStatus();
  }, [userProfile]);

  const handleSelectTeam = async (selectedTeam) => {
    if (locked) return;

    const { error } = await supabase
      .from('profiles')
      .update({ favorite_team: selectedTeam })
      .eq('id', userProfile.id);

    if (!error) {
      setTeam(selectedTeam);
    }
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-md border border-gray-100">
      <h3 className="text-lg font-bold text-gray-800 mb-4">⭐ MON ÉQUIPE FAVORITE</h3>

      {!team ? (
        <div>
          <p className="text-gray-500 mb-4">Aucune équipe choisie</p>
          {!locked ? (
            <div className="flex gap-2">
              <button onClick={() => handleSelectTeam('PSG')} className="px-4 py-2 bg-blue-600 text-white rounded-lg">PSG</button>
              <button onClick={() => handleSelectTeam('OM')} className="px-4 py-2 bg-sky-500 text-white rounded-lg">OM</button>
              <button onClick={() => handleSelectTeam('Lens')} className="px-4 py-2 bg-red-600 text-white rounded-lg">Lens</button>
            </div>
          ) : (
            <p className="text-red-500 font-semibold">🔒 Choix verrouillé</p>
          )}
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">🟦</span>
            <span className="font-bold text-lg">{team}</span>
          </div>
          <p className="text-green-600 text-sm font-medium mb-3">Choix enregistré.</p>
          <p className="text-gray-400 text-xs">Date limite :<br />{deadline}</p>
          {locked && <p className="mt-3 text-red-500 font-semibold text-sm">🔒 Choix verrouillé</p>}
        </div>
      )}
    </div>
  );
}